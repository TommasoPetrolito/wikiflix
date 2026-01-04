import { setCached, getCached } from './cache';

const DEFAULT_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_SPARQL_ENDPOINT = typeof window !== 'undefined' && import.meta.env.DEV
  ? '/sparql'
  : DEFAULT_SPARQL_ENDPOINT;
const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_RETRIES = 1;
const BASE_DELAY_MS = 2000;
const MIN_INTERVAL_MS = 5000; // even stricter throttle between successive queries to avoid 429s
const REQUEST_TIMEOUT_MS = 15000;
let lastRequestAt = 0;
let requestMutex: Promise<void> = Promise.resolve();

const acquireSlot = async () => {
  let release!: () => void;
  const previous = requestMutex;
  requestMutex = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  return release;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readStaleCache = <T>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(`${'wikiflix_cache:'}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data as T;
  } catch {
    return null;
  }
};

export interface WikidataMedia {
  id: string; // e.g., Q11424
  title: string;
  description?: string;
  videoUrl: string;
  poster?: string;
  subtitles?: string;
  year?: number;
  sitelinks?: number;
  genres?: string[];
  cast?: string[];
}

const mergeMedia = (items: WikidataMedia[]): WikidataMedia[] => {
  const map = new Map<string, WikidataMedia>();
  for (const item of items) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, {
        ...item,
        genres: item.genres ? [...item.genres] : undefined,
        cast: item.cast ? [...item.cast] : undefined,
      });
      continue;
    }
    map.set(item.id, {
      ...existing,
      title: existing.title || item.title,
      description: existing.description || item.description,
      videoUrl: existing.videoUrl || item.videoUrl,
      poster: existing.poster || item.poster,
      subtitles: existing.subtitles || item.subtitles,
      year: existing.year ?? item.year,
      sitelinks: existing.sitelinks ?? item.sitelinks,
      genres: [...new Set([...(existing.genres || []), ...(item.genres || [])])],
      cast: [...new Set([...(existing.cast || []), ...(item.cast || [])])],
    });
  }
  return Array.from(map.values());
};

const fetchSparql = async <T>(query: string, cacheKey: string, ttlMs = DEFAULT_TTL): Promise<T[]> => {
  const cached = getCached<T[]>(cacheKey);
  if (cached) return cached;

  const url = WIKIDATA_SPARQL_ENDPOINT;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const release = await acquireSlot();
      try {
        const sinceLast = Date.now() - lastRequestAt;
        if (sinceLast < MIN_INTERVAL_MS) {
          await delay(MIN_INTERVAL_MS - sinceLast + Math.random() * 200);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS + Math.random() * 2000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/sparql-results+json',
            'Content-Type': 'application/sparql-query',
          },
          body: query,
          signal: controller.signal,
        });
        lastRequestAt = Date.now();
        clearTimeout(timeoutId);

        if (!res.ok) {
          lastError = new Error(`Wikidata SPARQL error: ${res.status}`);
          if (res.status === 429 || res.status === 503) {
            await delay(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 400);
            continue;
          }
          throw lastError;
        }

        const json = await res.json();
        const bindings = json?.results?.bindings ?? [];
        const mapped = bindings.map((b: any) => mapBindingToMedia(b));
        const merged = mergeMedia(mapped);
        setCached(cacheKey, merged as T[], ttlMs);
        return merged as T[];
      } finally {
        release();
      }
    } catch (err) {
      lastError = err;
      await delay(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 400);
    }
  }

  const stale = readStaleCache<T[]>(cacheKey);
  if (stale) {
    console.warn('Using stale Wikidata cache for', cacheKey, lastError);
    return stale;
  }

  throw lastError instanceof Error ? lastError : new Error('Wikidata fetch failed');
};

const mapBindingToMedia = (b: any): WikidataMedia => {
  const id = b.item?.value?.split('/').pop() || 'unknown';
  const title = b.itemLabel?.value ?? 'Untitled';
  const description = b.description?.value;
  const videoUrl = b.video?.value ?? '';
  const poster = b.image?.value;
  const subtitles = b.subtitles?.value;
  const year = b.publicationDate?.value ? Number(b.publicationDate.value.slice(0, 4)) : undefined;
  const sitelinks = b.sitelinks?.value ? Number(b.sitelinks.value) : undefined;
  const genre = b.genreLabel?.value;
  const cast = b.castLabel?.value;
  return {
    id,
    title,
    description,
    videoUrl,
    poster,
    subtitles,
    year,
    sitelinks,
    genres: genre ? [genre] : undefined,
    cast: cast ? [cast] : undefined,
  };
};

export const fetchPublicDomainFilms = async (limit = 100) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    ?item wdt:P31 wd:Q11424.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL {
      ?item schema:description ?description.
      FILTER(LANG(?description) = "it")
    }
  } LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `films_${limit}`);
};

export const searchByTitle = async (queryText: string, limit = 50) => {
  const safeQuery = queryText.trim();
  if (!safeQuery) return [] as WikidataMedia[];
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    ?item wdt:P31 wd:Q11424.
    OPTIONAL { ?item wdt:P10 ?video. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
    FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${safeQuery}")))
  } LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `search_${safeQuery}_${limit}`);
};

export const fetchRandomSet = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    ?item wdt:P31 wd:Q11424.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY RAND()
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `random_${limit}`);
};

// Popular proxy: order by sitelinks (as a rough measure of prominence)
export const fetchPopular = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    ?item wdt:P31 wd:Q11424;
      wikibase:sitelinks ?sitelinks.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY DESC(?sitelinks)
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `popular_${limit}`);
};

// Recently added proxy: order by publication date desc
export const fetchRecentlyAdded = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    ?item wdt:P31 wd:Q11424;
      wdt:P577 ?publicationDate.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?genre. ?genre rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY DESC(?publicationDate)
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `recent_${limit}`);
};

// Fetch by genre (P136) using a Wikidata Q-id for the genre
export const fetchByGenre = async (genreQid: string, limit = 60) => {
  const safeGenre = genreQid.trim();
  if (!safeGenre) return [] as WikidataMedia[];
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    VALUES ?genre { wd:${safeGenre} }
    ?item wdt:P31 wd:Q11424;
          wdt:P136 ?genre.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?g. ?g rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?item wdt:P161 ?cast. ?cast rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY DESC(?sitelinks) DESC(?publicationDate)
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `genre_${safeGenre}_${limit}`);
};

// Related content by cast or genre similarity to an anchor Q-id
export const fetchRelatedByCastOrGenre = async (anchorQid: string, limit = 60) => {
  const safeAnchor = anchorQid.trim();
  if (!safeAnchor) return [] as WikidataMedia[];
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks ?genreLabel ?castLabel WHERE {
    VALUES ?anchor { wd:${safeAnchor} }
    ?anchor wdt:P136 ?anchorGenre.
    OPTIONAL { ?anchor wdt:P161 ?anchorCast. }

    ?item wdt:P31 wd:Q11424.
    OPTIONAL { ?item wdt:P10 ?video. }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?g. }
    OPTIONAL { ?item wdt:P161 ?c. }
    OPTIONAL { ?g rdfs:label ?genreLabel. FILTER(LANG(?genreLabel) IN ("en","it")) }
    OPTIONAL { ?c rdfs:label ?castLabel. FILTER(LANG(?castLabel) IN ("en","it")) }

    FILTER(?item != ?anchor)
    FILTER(BOUND(?g) || BOUND(?c))
    FILTER(?g = ?anchorGenre || ?c = ?anchorCast)

    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY DESC(?sitelinks) DESC(?publicationDate)
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `related_${safeAnchor}_${limit}`);
};
