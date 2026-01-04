import { setCached, getCached } from './cache';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes

export interface WikidataMedia {
  id: string; // e.g., Q11424
  title: string;
  description?: string;
  videoUrl: string;
  poster?: string;
  subtitles?: string;
  year?: number;
  sitelinks?: number;
}

const fetchSparql = async <T>(query: string, cacheKey: string, ttlMs = DEFAULT_TTL): Promise<T[]> => {
  const cached = getCached<T[]>(cacheKey);
  if (cached) return cached;

  const url = `${WIKIDATA_SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'wikiflix/1.0 (https://github.com/TommasoPetrolito/wikiflix)',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL error: ${res.status}`);
  }

  const json = await res.json();
  const bindings = json?.results?.bindings ?? [];
  const mapped = bindings.map((b: any) => mapBindingToMedia(b));
  setCached(cacheKey, mapped as T[], ttlMs);
  return mapped as T[];
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
  return { id, title, description, videoUrl, poster, subtitles, year, sitelinks };
};

export const fetchPublicDomainFilms = async (limit = 100) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate WHERE {
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
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
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles WHERE {
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
    FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${safeQuery}")))
  } LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `search_${safeQuery}_${limit}`);
};

export const fetchRandomSet = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles WHERE {
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY RAND()
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `random_${limit}`);
};

// Popular proxy: order by sitelinks (as a rough measure of prominence)
export const fetchPopular = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks WHERE {
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video;
          wikibase:sitelinks ?sitelinks.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
    OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "it") }
  }
  ORDER BY DESC(?sitelinks)
  LIMIT ${limit}`;
  return fetchSparql<WikidataMedia>(query, `popular_${limit}`);
};

// Recently added proxy: order by publication date desc
export const fetchRecentlyAdded = async (limit = 40) => {
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate WHERE {
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video;
          wdt:P577 ?publicationDate.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
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
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks WHERE {
    VALUES ?genre { wd:${safeGenre} }
    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video;
          wdt:P136 ?genre.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
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
  const query = `SELECT ?item ?itemLabel ?description ?video ?image ?subtitles ?publicationDate ?sitelinks WHERE {
    VALUES ?anchor { wd:${safeAnchor} }
    ?anchor wdt:P136 ?anchorGenre.
    OPTIONAL { ?anchor wdt:P161 ?anchorCast. }

    ?item wdt:P31 wd:Q11424;
          wdt:P10 ?video.
    OPTIONAL { ?item wdt:P18 ?image. }
    OPTIONAL { ?item wdt:P1173 ?subtitles. }
    OPTIONAL { ?item wdt:P577 ?publicationDate. }
    OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
    OPTIONAL { ?item wdt:P136 ?g. }
    OPTIONAL { ?item wdt:P161 ?c. }

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
