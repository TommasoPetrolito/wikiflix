import { Content, Stream } from '@/types';

// Lightweight search throttle/cache to avoid hammering MediaWiki
const SEARCH_MIN_INTERVAL_MS = 8000;
let lastSearchAt = 0;
const searchCache = new Map<string, Content[]>();
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

// Query buckets per row (MediaWiki, no SPARQL, no static catalog)
const POPULAR_QUERIES = [
  'classic film',
  'feature film',
  'silent film',
  'public domain film',
  'movie trailer',
  'documentary film',
  'film noir',
  'animated film',
];

const RECENT_QUERIES = [
  'restored film',
  'remastered film',
  'newly uploaded film',
  'public domain film',
];

const CRITICS_QUERIES = [
  'award winning film',
  'cannes film',
  'academy award film',
  'classic masterpiece film',
];

const HIDDEN_QUERIES = [
  'experimental film',
  'short film',
  'art film',
  'silent film 1920s',
  'avant garde film',
];

const FORYOU_QUERIES = [
  'comedy film',
  'romance film',
  'drama film',
  'action film',
  'adventure film',
];

// Thematic buckets for tighter curation
const FEMALE_DIRECTOR_QUERIES = [
  'film directed by woman',
  'female director film trailer',
  'women filmmaker film',
  'film by female director',
];

const LGBT_QUERIES = [
  'lgbt film trailer',
  'queer film trailer',
  'gay film trailer',
  'lesbian film trailer',
];

const SCI_FI_QUERIES = [
  'science fiction film trailer',
  'sci-fi film trailer',
  'space opera film trailer',
];

const ROMCOM_QUERIES = [
  'romantic comedy film trailer',
  'romcom film trailer',
  'romance comedy film trailer',
];

type RegionKey = 'spanish' | 'uk' | 'australia' | 'canada' | 'brazil' | 'germany';

const REGION_QUERY_MAP: Record<RegionKey, string[]> = {
  spanish: ['spanish-language film trailer', 'mexican film trailer', 'argentine film trailer'],
  uk: ['british film trailer', 'english film trailer', 'uk film trailer'],
  australia: ['australian film trailer', 'australian tv film trailer'],
  canada: ['canadian film trailer', 'quebec film trailer'],
  brazil: ['brazilian film trailer', 'portuguese-language film trailer'],
  germany: ['german film trailer', 'german-language film trailer'],
};

const SEED_FALLBACK_QUERIES = [
  'Nosferatu',
  'Metropolis',
  'His Girl Friday',
  'Sherlock Jr.',
  'The Kid 1921 film',
  'A Trip to the Moon film',
  'The Great Train Robbery 1903 film',
  'The Cabinet of Dr. Caligari',
];

const GENRE_QUERY_MAP: Record<number, string[]> = {
  28: ['action film trailer', 'adventure film trailer'],
  35: ['comedy film trailer', 'screwball comedy film'],
  27: ['horror film trailer', 'silent horror film'],
  53: ['thriller film trailer', 'noir thriller film'],
  16: [
    'animated short film',
    'animation film trailer',
    'animated public domain film',
    'open source animated film',
    'blender open movie',
    'big buck bunny',
    'mickey mouse cartoon',
  ],
  10751: [
    'family film trailer',
    'children film',
    'public domain animated film',
    'silent animated film',
    'animated classic film',
  ],
  80: ['crime film trailer', 'film noir trailer'],
  878: ['science fiction film trailer', 'sci-fi film trailer', 'space opera film trailer'],
  10749: ['romantic comedy film trailer', 'romantic film trailer'],
  10765: ['science fiction television film trailer', 'science fiction tv trailer'],
};

const categoryCache = new Map<string, Content[]>();
const inflightCategory = new Map<string, Promise<Content[]>>();

const FALLBACK_POSTER = 'https://dummyimage.com/600x900/0f172a/f43f5e&text=Wikiflix';
const FALLBACK_BACKDROP = 'https://dummyimage.com/1280x720/0f172a/f8fafc&text=Wikiflix';

const toCommonsFilePath = (url: string | undefined | null) => {
  if (!url) return '';
  // Force https to avoid mixed-content blocks that prevent playback
  const httpsUrl = url.replace(/^http:\/\//i, 'https://');

  // If it's a bare filename (no protocol), build a Special:FilePath URL
  if (!/^https?:\/\//i.test(httpsUrl)) {
    const decoded = decodeURIComponent(httpsUrl);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}`;
  }

  // If already a Special:FilePath URL, keep it (video tags can follow redirects cross-origin)
  if (httpsUrl.includes('Special:FilePath')) return httpsUrl;

  // If it's a commons File: URL, convert to FilePath via proxy for direct fetch
  const fileMatch = httpsUrl.match(/File:(.+)$/);
  if (fileMatch) {
    const decoded = decodeURIComponent(fileMatch[1]);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}`;
  }

  // If it's already on upload.wikimedia.org, keep direct (best success rate in video tag)
  if (httpsUrl.includes('upload.wikimedia.org')) {
    return httpsUrl;
  }

  return httpsUrl;
};

// Minimal fallback title to keep UI usable when Wikidata times out
const FALLBACK_CONTENT: Content = {
  id: 'fallback-clockwork',
  title: 'A Clockwork Orange (Trailer)',
  type: 'movie',
  year: 1971,
  poster: 'https://commons.wikimedia.org/wiki/Special:FilePath/Clockwork%20Orange%20Trailer%20poster.png',
  backdrop: 'https://commons.wikimedia.org/wiki/Special:FilePath/Clockwork%20Orange%20Trailer%20poster.png',
  description: 'Fallback trailer from Wikimedia Commons.',
  videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/87/A_Clockwork_Orange_%281971%29_-_Trailer.webm',
  subtitles: undefined,
  genres: ['Drama'],
  cast: [],
};

const MINIMAL_FALLBACKS: Content[] = [
  FALLBACK_CONTENT,
];

const waitForSearchSlot = async () => {
  const now = Date.now();
  const sinceLast = now - lastSearchAt;
  if (sinceLast < SEARCH_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, SEARCH_MIN_INTERVAL_MS - sinceLast));
  }
  lastSearchAt = Date.now();
};

type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, any[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
};

const LANGUAGE_LABELS: Record<string, string> = {
  Q1860: 'English',
  Q652: 'Italian',
  Q150: 'French',
  Q1321: 'Spanish',
  Q188: 'German',
  Q5146: 'Portuguese',
  Q5287: 'Japanese',
  Q7850: 'Chinese',
  Q7737: 'Polish',
  Q18813: 'Russian',
};

const extractClaimValue = (snak: any): string | undefined => {
  const val = snak?.mainsnak?.datavalue?.value;
  if (!val) return undefined;
  if (typeof val === 'string') return val;
  if (val.entity?.id) return val.entity.id;
  if (val.id) return val.id;
  if (val.text) return val.text;
  if (val.amount) return String(val.amount);
  return undefined;
};

const collectClaimValues = (claims: any[] | undefined): string[] => {
  if (!claims) return [];
  return claims
    .map((c) => extractClaimValue(c))
    .filter((v): v is string => Boolean(v));
};

const extractLanguageFromClaim = (claim: any): string | undefined => {
  const qual = claim?.qualifiers;
  const langClaim = qual?.P407?.[0] || qual?.P364?.[0];
  const langId = extractClaimValue(langClaim);
  if (!langId) return undefined;
  return LANGUAGE_LABELS[langId] || langId;
};

const GENRE_TAG_LABELS: Record<string, string> = {
  Q130232: 'Documentary',
  Q2484376: 'Short film',
  Q291688: 'Animated film',
  Q277759: 'Silent film',
  Q192439: 'Film noir',
  Q859369: 'Science fiction',
  Q471839: 'Horror',
  Q319221: 'Thriller',
  Q157394: 'Comedy',
  Q200092: 'Action',
  Q858216: 'Adventure',
  Q269093: 'Fantasy',
  Q157443: 'Crime',
  Q1259759: 'Drama',
  Q1054574: 'Musical',
  Q1091100: 'Family',
  Q824186: 'Black-and-white',
  Q3957: 'Biographical',
  Q25379: 'Television film',
  Q21191270: 'Web series',
};

const mapGenreTags = (genreIds: string[]): string[] => {
  const tags: string[] = [];
  genreIds.forEach((id) => {
    const label = GENRE_TAG_LABELS[id];
    if (label) tags.push(label);
  });
  const seen = new Set<string>();
  return tags.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
};

const parseDurationSeconds = (claim: any): number | undefined => {
  const val = claim?.mainsnak?.datavalue?.value;
  if (!val) return undefined;
  const amount = val.amount ? Number(val.amount) : undefined;
  if (amount === undefined || Number.isNaN(amount)) return undefined;
  const unit: string | undefined = val.unit;
  // Wikidata units: Q11574 second, Q7727 minute, Q25235 hour
  if (unit?.endsWith('Q7727')) return amount * 60;
  if (unit?.endsWith('Q25235')) return amount * 3600;
  // default assumes seconds (Q11574) or unitless already in seconds
  return amount;
};

const mapEntityToContent = (entity: WikidataEntity): Content | null => {
  const title = entity.labels?.en?.value || entity.labels?.it?.value;
  if (!title) return null;

  const desc = entity.descriptions?.it?.value || entity.descriptions?.en?.value;
  const claims = entity.claims || {};
  const rawVideos = (claims.P10 || []).map((c: any) => ({
    url: extractClaimValue(c),
    lang: extractLanguageFromClaim(c),
  }));
  const videoClaims = rawVideos
    .map((v) => ({ url: v.url ? toCommonsFilePath(v.url) : '', lang: v.lang }))
    .filter((v) => Boolean(v.url));
  const imageClaim = extractClaimValue(claims.P18?.[0]);
  const rawSubtitles = (claims.P1173 || []).map((c: any) => ({
    url: extractClaimValue(c),
    lang: extractLanguageFromClaim(c),
  }));
  const subtitleTracks = rawSubtitles
    .map((s) => ({
      src: s.url ? toCommonsFilePath(String(s.url)) : '',
      lang: s.lang,
      label: s.lang ? `Subtitles (${s.lang})` : 'Subtitles',
    }))
    .filter((s) => Boolean(s.src));
  const dateClaim = extractClaimValue(claims.P577?.[0]);
  const year = dateClaim && typeof dateClaim === 'string' ? Number(dateClaim.slice(0, 4)) : undefined;
  const youtubeIds = collectClaimValues(claims.P1651);
  const archiveIds = collectClaimValues(claims.P724);
  const licenseClaim = extractClaimValue(claims.P275?.[0]);
  const durationClaim = parseDurationSeconds(claims.P2047?.[0]);
  const genreIds = collectClaimValues(claims.P136);

  const enWiki = entity.sitelinks?.enwiki?.title;
  const itWiki = entity.sitelinks?.itwiki?.title;
  const wikipediaUrl = enWiki
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enWiki)}`
    : itWiki
      ? `https://it.wikipedia.org/wiki/${encodeURIComponent(itWiki)}`
      : undefined;

  // Skip non-media (no video)
  if (!videoClaims.length) return null;

  const primaryVideo = videoClaims[0];

  const altVideos: Array<{ kind: 'commons' | 'youtube' | 'archive'; url: string; label?: string; lang?: string }> = [];
  videoClaims.slice(1).forEach((v) => altVideos.push({ kind: 'commons', url: v.url, label: v.lang ? `${v.lang}` : undefined, lang: v.lang }));
  youtubeIds.forEach((id) => altVideos.push({ kind: 'youtube', url: `https://www.youtube.com/watch?v=${id}`, label: 'YouTube' }));
  archiveIds.forEach((id) => altVideos.push({ kind: 'archive', url: `https://archive.org/details/${id}`, label: 'Internet Archive' }));

  const commonsLink = entity.sitelinks?.commonswiki?.url
    || (entity.sitelinks?.commonswiki?.title
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(entity.sitelinks.commonswiki.title)}`
      : undefined);

  const isTrailer = /trailer/i.test(title) || videoClaims.some((v) => /trailer/i.test(v.url));
  const durationSeconds = durationClaim;

  return {
    id: entity.id,
    wikidataId: entity.id,
    title,
    type: 'movie',
    year,
    poster: toCommonsFilePath(imageClaim) || FALLBACK_POSTER,
    backdrop: toCommonsFilePath(imageClaim) || FALLBACK_BACKDROP,
    description: desc || 'Result from Wikidata',
    descriptionLong: desc || 'Result from Wikidata',
    videoUrl: primaryVideo?.url || '',
    language: primaryVideo?.lang,
    subtitles: subtitleTracks[0]?.src,
    subtitleTracks: subtitleTracks.length ? subtitleTracks : undefined,
    altVideos: altVideos.length ? altVideos : undefined,
    commonsLink,
    wikipediaUrl,
    license: licenseClaim,
    durationSeconds,
    isTrailer,
    genres: mapGenreTags(genreIds),
    cast: undefined,
  };
};

const searchViaMediaWiki = async (query: string, limit = 4): Promise<Content[]> => {
  try {
    // Prefer Cirrus search with statements to force film + video (P31 film, P10 video)
    const srQuery = `${query} haswbstatement:P10 haswbstatement:P31=Q11424`;
    const searchUrl = `${WIKIDATA_API}?action=query&format=json&origin=*&list=search&srlimit=${limit}&srsearch=${encodeURIComponent(srQuery)}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchJson = await searchRes.json();
    const ids = (searchJson.query?.search || [])
      .map((s: any) => s.title)
      .filter((id: string) => /^Q\d+/.test(id))
      .slice(0, limit);

    // Fallback to wbsearchentities if statement search is empty
    let entityIds = ids;
    if (entityIds.length === 0) {
      const wbUrl = `${WIKIDATA_API}?action=wbsearchentities&format=json&language=en&limit=${limit}&origin=*&search=${encodeURIComponent(query)}`;
      const wbRes = await fetch(wbUrl);
      if (!wbRes.ok) throw new Error(`wbsearchentities ${wbRes.status}`);
      const wbJson = await wbRes.json();
      entityIds = (wbJson.search || []).map((s: any) => s.id).slice(0, limit);
    }

    if (entityIds.length === 0) return [];

    const withVideo = await fetchEntitiesByIds(entityIds);
    return withVideo;
  } catch (err) {
    console.error('mediawiki search failed', err);
    return [];
  }
};

const searchWithThrottle = async (query: string, limit = 4): Promise<Content[]> => {
  await waitForSearchSlot();
  return searchViaMediaWiki(query, limit);
};

const dedupeContent = (items: Content[]): Content[] => {
  const seen = new Set<string>();
  const out: Content[] = [];
  for (const item of items) {
    const key = (item.id ? String(item.id) : item.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

const fetchEntitiesByIds = async (entityIds: string[], limitLang = 'en|it'): Promise<Content[]> => {
  if (entityIds.length === 0) return [];
  const detailUrl = `${WIKIDATA_API}?action=wbgetentities&format=json&languages=${limitLang}&props=labels|descriptions|claims|sitelinks&origin=*&ids=${entityIds.join('|')}`;
  const detailRes = await fetch(detailUrl);
  if (!detailRes.ok) throw new Error(`wbgetentities ${detailRes.status}`);
  const detailJson = await detailRes.json();
  const entities: WikidataEntity[] = Object.values(detailJson.entities || {});
  const mapped = entities.map(mapEntityToContent).filter((c): c is Content => Boolean(c));
  return mapped.filter((c) => c.videoUrl && c.videoUrl.trim());
};

const shuffle = <T>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const fetchCategoryPool = async (
  key: string,
  queries: string[],
  perQueryLimit = 6,
  targetSize = 40,
  fallbackQueries: string[] = SEED_FALLBACK_QUERIES
): Promise<Content[]> => {
  if (categoryCache.has(key)) return categoryCache.get(key)!;
  if (inflightCategory.has(key)) return inflightCategory.get(key)!;

  const run = async () => {
    const buckets = queries.length ? queries : fallbackQueries;
    const collected: Content[] = [];
    for (const q of buckets) {
      const res = await searchWithThrottle(q, perQueryLimit).catch(() => [] as Content[]);
      if (res.length) collected.push(...res);
      if (collected.length >= targetSize) break;
    }
    const flattened = dedupeContent(collected.filter((c) => c.videoUrl));
    const trimmed = flattened.slice(0, targetSize);
    return trimmed.length > 0 ? trimmed : MINIMAL_FALLBACKS;
  };

  const p = run().then((res) => {
    const isFallbackOnly = res.length === MINIMAL_FALLBACKS.length && res.every((c) => c.id === FALLBACK_CONTENT.id);
    if (!isFallbackOnly) {
      categoryCache.set(key, res);
    } else {
      categoryCache.delete(key);
    }
    inflightCategory.delete(key);
    return res;
  });
  inflightCategory.set(key, p);
  return p;
};

const getLocalPool = async (): Promise<Content[]> => {
  // Use popular bucket as general pool for fallbacks
  return fetchCategoryPool('popular', POPULAR_QUERIES, 8, 60);
};

// --- Adapters matching the previous TMDB API surface ---
export const searchTMDB = async (query: string): Promise<Content[]> => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (searchCache.has(q)) return searchCache.get(q)!;

  // Client-side pacing to reduce 429s
  await waitForSearchSlot();

  try {
    // First attempt: MediaWiki search API (no SPARQL)
    const mwResults = await searchViaMediaWiki(q);
    if (mwResults.length > 0) {
      searchCache.set(q, mwResults);
      return mwResults;
    }
  } catch (err) {
    console.error('search: upstream failed, fallback to local pool', err);
  }

  // Fallback: local pool (popular bucket)
  const localPool = await getLocalPool();
  const filtered = localPool.filter((c) => c.title.toLowerCase().includes(q));
  if (filtered.length > 0) return filtered.slice(0, 12);

  // If nothing, show minimal fallback
  return MINIMAL_FALLBACKS;
};

export const getTrendingMovies = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('popular', POPULAR_QUERIES, 8, 60);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : [FALLBACK_CONTENT];
};

export const getTopRatedMovies = getTrendingMovies;
export const getTopRatedTV = getTrendingMovies;
export const getTrendingTV = getTrendingMovies;

export const getTop10 = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('popular', POPULAR_QUERIES, 8, 60);
  const items = shuffle(pool).slice(0, 10);
  return items.length > 0 ? items : [FALLBACK_CONTENT];
};

export const getByGenre = async (_mediaType: 'movie' | 'tv', _genreId: number, limit = 40): Promise<Content[]> => {
  const queries = GENRE_QUERY_MAP[_genreId] || FORYOU_QUERIES;
  const pool = await fetchCategoryPool(`genre-${_genreId}`, queries, 8, 60);
  const items = shuffle(pool).slice(0, Math.min(limit, 20));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getRegionalContent = async (region: RegionKey, limit = 18): Promise<Content[]> => {
  const queries = REGION_QUERY_MAP[region] || [];
  const pool = await fetchCategoryPool(`region-${region}`, queries, 6, 50);
  const items = shuffle(pool).slice(0, Math.min(limit, 18));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getFemaleDirectedContent = async (limit = 24): Promise<Content[]> => {
  const pool = await fetchCategoryPool('female-directors', FEMALE_DIRECTOR_QUERIES, 6, 50);
  const items = shuffle(pool).slice(0, Math.min(limit, 24));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getLGBTContent = async (limit = 18): Promise<Content[]> => {
  const pool = await fetchCategoryPool('lgbt', LGBT_QUERIES, 6, 50);
  const items = shuffle(pool).slice(0, Math.min(limit, 18));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getScienceFictionContent = async (limit = 18): Promise<Content[]> => {
  const pool = await fetchCategoryPool('sci-fi', SCI_FI_QUERIES, 6, 50);
  const items = shuffle(pool).slice(0, Math.min(limit, 18));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getRomanticComedyContent = async (limit = 18): Promise<Content[]> => {
  const pool = await fetchCategoryPool('romcom', ROMCOM_QUERIES, 6, 50);
  const items = shuffle(pool).slice(0, Math.min(limit, 18));
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getRecommendations = async (_type: 'movie' | 'tv', anchorId: number | string): Promise<Content[]> => {
  // Temporarily disable heavy related-content queries to avoid timeouts/429s
  return [];
};

export const getUpcomingMovies = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('recent', RECENT_QUERIES, 6, 40);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getCriticallyAcclaimed = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('critics', CRITICS_QUERIES, 6, 40);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getHiddenGems = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('hidden', HIDDEN_QUERIES, 6, 40);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

export const getTrendingToday = getTrendingMovies;

export const getMoviesByActor = async (_actor: string): Promise<{ actor: string; content: Content[]; profilePath: string | null } | null> => {
  // Actor-based queries require a different SPARQL; placeholder returning null for now.
  return null;
};

export const findCollectionByMovie = async (_movieId: number): Promise<{ name: string; content: Content[] } | null> => {
  // Collections are TMDB-specific; return null for now.
  return null;
};

export const getRecentlyAdded = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('recent', RECENT_QUERIES, 6, 40);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

// For You content placeholder – can be wired to a curated/random set
export const getForYouContent = async (): Promise<Content[]> => {
  const pool = await fetchCategoryPool('foryou', FORYOU_QUERIES, 8, 60);
  const items = shuffle(pool).slice(0, 20);
  return items.length > 0 ? items : MINIMAL_FALLBACKS;
};

// Live streams are out of scope for Wikidata; return empty
export const getLiveStreams = async (): Promise<Stream[]> => [];

// Helper to fetch a hero item
export const getHeroCandidate = async (): Promise<Content | null> => {
  const pool = await fetchCategoryPool('popular', POPULAR_QUERIES, 8, 60);
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return FALLBACK_CONTENT;
};

// Bulk fetch for home rows
export const getHomeBatches = async () => {
  return {
    popular: await getTrendingMovies(),
    recent: await getRecentlyAdded(),
    random: await getHiddenGems(),
  };
};
