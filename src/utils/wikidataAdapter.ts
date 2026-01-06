import { Content } from '@/types';

interface CatalogItem {
  id: string;
  wikidataId?: string;
  title: string;
  titleLabels?: Record<string, string>;
  type?: 'movie' | 'tv';
  year?: number;
  poster?: string;
  backdrop?: string;
  description?: string;
  descriptionLong?: string;
  descriptions?: Record<string, string>;
  videoUrl?: string;
  altVideos?: Array<{ kind: string; url: string; label?: string }>;
  genres?: Array<{ id: string; label: string }>;
  instances?: Array<{ id: string; label: string }>;
  directors?: Array<{ id: string; label: string }>;
  languages?: Array<{ id: string; label: string }>;
  countries?: Array<{ id: string; label: string }>;
  genreIds?: string[];
  instanceIds?: string[];
  languageIds?: string[];
  countryIds?: string[];
   durationSeconds?: number;
}

type RegionKey = 'spanish' | 'uk' | 'australia' | 'canada' | 'brazil' | 'germany';

type MoodKey = 'action' | 'comedy' | 'dark' | 'family';

const MANIFEST_URL = '/catalog/catalog_v2_manifest.json';
const CATALOG_URL = '/catalog/catalog_v2.jsonl';
const EMBEDDINGS_URL = '/catalog/catalog_v2_embeddings.f32';

const REGION_COUNTRY_LABELS: Record<RegionKey, string[]> = {
  spanish: ['Spain', 'Mexico', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Uruguay'],
  uk: ['United Kingdom', 'England', 'United Kingdom of Great Britain and Ireland'],
  australia: ['Australia'],
  canada: ['Canada'],
  brazil: ['Brazil'],
  germany: ['Germany'],
};

// TMDB genre id -> label fragments to match against catalog genres
const TMDB_GENRE_KEYWORDS: Record<number, string[]> = {
  28: ['action'],
  12: ['adventure'],
  16: ['animation', 'animated'],
  35: ['comedy'],
  80: ['crime'],
  99: ['documentary'],
  18: ['drama'],
  10751: ['family'],
  14: ['fantasy'],
  36: ['history', 'historical'],
  27: ['horror'],
  10402: ['music', 'musical'],
  9648: ['mystery'],
  10749: ['romance'],
  878: ['science fiction', 'sci-fi'],
  10770: ['television film', 'tv film'],
  53: ['thriller', 'suspense', 'noir'],
  10752: ['war'],
  37: ['western'],
};

let catalogPromise: Promise<Content[]> | null = null;
let manifestPromise: Promise<{ dim: number }> | null = null;
let embeddingsPromise: Promise<Float32Array> | null = null;
let encoderPromise: Promise<(text: string) => Promise<Float32Array>> | null = null;

const normalize = (text: string) => text.toLowerCase();

const tokenize = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const l2Normalize = (vec: Float32Array): Float32Array => {
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(Math.max(norm, 1e-12));
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i += 1) {
    out[i] = vec[i] / norm;
  }
  return out;
};

const mapItemToContent = (item: CatalogItem): Content => {
  const description =
    item.descriptionLong ||
    item.descriptions?.en ||
    item.description ||
    Object.values(item.descriptions || {})[0] ||
    '';

  const poster =
    item.poster ||
    item.backdrop ||
    item.videoUrl ||
    item.altVideos?.[0]?.url ||
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Placeholder_view_vector.svg/640px-Placeholder_view_vector.svg.png';

  const backdrop = item.backdrop || poster;

  return {
    id: item.id || item.wikidataId || crypto.randomUUID(),
    title: item.title,
    titleLabels: item.titleLabels,
    type: item.type === 'tv' ? 'tv' : 'movie',
    year: item.year,
    poster,
    backdrop,
    description,
    descriptionLong: item.descriptionLong,
    descriptions: item.descriptions,
    videoUrl: item.videoUrl,
    altVideos: item.altVideos?.map(v => ({
      kind: (v.kind as any) || 'commons',
      url: v.url,
      label: v.label,
    })),
    language: item.languages?.[0]?.label,
    genres: item.genres?.map(g => g.label),
    directors: item.directors?.map(d => d.label),
    countries: item.countries?.map(c => c.label),
    durationSeconds: (item as any).durationSeconds,
  };
};

async function loadCatalog(): Promise<Content[]> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    const res = await fetch(CATALOG_URL);
    const text = await res.text();
    const lines = text
      .split(/\n+/)
      .map(l => l.trim())
      .filter(Boolean);
    return lines.map(line => mapItemToContent(JSON.parse(line)));
  })();

  return catalogPromise;
}

const scoreContent = (content: Content, queryTokens: string[], normalizedQuery: string): number => {
  if (!queryTokens.length && !normalizedQuery) return 0;

  const title = normalize(content.title || '');
  const altTitles = Object.values(content.titleLabels || {}).map(normalize);
  const genres = normalize((content.genres || []).join(' '));
  const desc = normalize(content.description || '');
  const descs = Object.values(content.descriptions || {}).map(normalize);
  const countries = normalize((content.countries || []).join(' '));

  let score = 0;

  const allTitles = [title, ...altTitles];
  const allDescs = [desc, ...descs];

  if (normalizedQuery) {
    if (allTitles.some(t => t === normalizedQuery)) score += 140;
    else if (allTitles.some(t => t.includes(normalizedQuery))) score += 95;
    else if (allDescs.some(d => d.includes(normalizedQuery))) score += 30;
  }

  queryTokens.forEach(t => {
    if (allTitles.some(tt => tt.includes(t))) score += 14;
    if (genres.includes(t)) score += 6;
    if (countries.includes(t)) score += 4;
    if (allDescs.some(dd => dd.includes(t))) score += 2;
  });

  const recencyBoost = content.year ? Math.max(0, (content.year - 1990) / 5) : 0;
  return score + recencyBoost;
};

const sortByScore = <T extends { score: number }>(items: T[]) => items.sort((a, b) => b.score - a.score);

const loadManifest = async () => {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL)
    .then(res => res.json())
    .catch(() => ({ dim: 384 }));
  return manifestPromise;
};

const loadEmbeddings = async (): Promise<Float32Array> => {
  if (embeddingsPromise) return embeddingsPromise;
  embeddingsPromise = (async () => {
    const res = await fetch(EMBEDDINGS_URL);
    const buf = await res.arrayBuffer();
    return new Float32Array(buf);
  })();
  return embeddingsPromise;
};

const getQueryEncoder = async () => {
  if (encoderPromise) return encoderPromise;
  encoderPromise = (async () => {
    const { pipeline }: any = await import('@xenova/transformers');
    const pipe: any = await pipeline('feature-extraction', 'Xenova/intfloat-multilingual-e5-small', {
      progress_callback: () => {},
    });

    return async (text: string) => {
      const prefix = text.toLowerCase().includes('query:') ? text : `query: ${text}`;
      const output = await pipe(prefix, { pooling: 'mean', normalize: true });
      const data = output.data as number[] | Float32Array;
      return l2Normalize(Float32Array.from(data));
    };
  })();
  return encoderPromise;
};

const sample = <T>(arr: T[], n: number): T[] => {
  if (arr.length <= n) return [...arr];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

const filterByType = (items: Content[], type: 'movie' | 'tv' | 'all') =>
  type === 'all' ? items : items.filter(i => i.type === type);

const matchesGenre = (content: Content, tmdbGenreId: number) => {
  const keywords = TMDB_GENRE_KEYWORDS[tmdbGenreId];
  if (!keywords || !keywords.length) return false;
  const text = normalize([content.genres?.join(' '), content.description].filter(Boolean).join(' '));
  return keywords.some(k => text.includes(k));
};

type SearchOptions = {
  type?: 'movie' | 'tv' | 'all';
  genreId?: number | null;
  yearFrom?: number;
  yearTo?: number;
  limit?: number;
  sort?: 'relevance' | 'year' | 'title';
  useSemantic?: boolean;
};

export async function searchCatalog(query: string, options: SearchOptions = {}): Promise<Content[]> {
  const catalog = await loadCatalog();
  const tokens = tokenize(query);
  const normalizedQuery = normalize(query.trim());
  const type = options.type || 'all';
  const genreId = options.genreId ?? null;
  const limit = options.limit ?? 80;
  const yearFrom = options.yearFrom;
  const yearTo = options.yearTo;
  const sort = options.sort || 'relevance';
  const useSemantic = options.useSemantic !== false;

  const catalogWithIndex = catalog.map((item, idx) => ({ item, idx }));
  let items = catalogWithIndex.filter(ci => type === 'all' || ci.item.type === type);

  if (genreId) {
    items = items.filter(ci => matchesGenre(ci.item, genreId));
  }

  if (typeof yearFrom === 'number') {
    items = items.filter(ci => typeof ci.item.year === 'number' && ci.item.year >= yearFrom);
  }
  if (typeof yearTo === 'number') {
    items = items.filter(ci => typeof ci.item.year === 'number' && ci.item.year <= yearTo);
  }

  const textScored = items.map(ci => ({
    idx: ci.idx,
    item: ci.item,
    score: scoreContent(ci.item, tokens, normalizedQuery),
  }));
  sortByScore(textScored);
  const textRanked = textScored.filter(s => s.score > 0);

  let merged: { idx: number; item: Content; score: number }[] = textRanked;

  if (useSemantic && normalizedQuery) {
    try {
      const manifest = await loadManifest();
      const [embeddings, encode] = await Promise.all([loadEmbeddings(), getQueryEncoder()]);
      const queryEmbeddingRaw = await encode(query.trim());
      const dim = manifest.dim || queryEmbeddingRaw.length;
      const queryEmbedding = queryEmbeddingRaw.length === dim ? queryEmbeddingRaw : queryEmbeddingRaw.slice(0, dim);

      const semanticScores: Array<{ idx: number; score: number }> = [];
      const k = Math.max(limit * 2, 200);

      for (let i = 0; i < items.length; i += 1) {
        const { idx } = items[i];
        const offset = idx * dim;
        if (offset + dim > embeddings.length) continue;
        let dot = 0;
        for (let d = 0; d < dim; d += 1) {
          dot += queryEmbedding[d] * embeddings[offset + d];
        }
        semanticScores.push({ idx, score: dot });
      }

      semanticScores.sort((a, b) => b.score - a.score);
      const semanticTop = semanticScores.slice(0, k);

      // Reciprocal rank fusion between text and semantic
      const rrfK = 60;
      const rrf = new Map<number, number>();

      textRanked.forEach((entry, rank) => {
        rrf.set(entry.idx, (rrf.get(entry.idx) || 0) + 1 / (rrfK + rank + 1));
      });

      semanticTop.forEach((entry, rank) => {
        rrf.set(entry.idx, (rrf.get(entry.idx) || 0) + 1 / (rrfK + rank + 1));
      });

      merged = Array.from(rrf.entries())
        .map(([idx, score]) => ({ idx, score, item: catalog[idx] }))
        .sort((a, b) => b.score - a.score);
    } catch (err) {
      console.warn('Semantic search unavailable, falling back to text only', err);
    }
  }

  let ranked = merged.map(m => m.item);

  if (sort === 'year') {
    ranked = [...ranked].sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sort === 'title') {
    ranked = [...ranked].sort((a, b) => a.title.localeCompare(b.title));
  }

  return ranked.slice(0, limit);
}

export async function searchTMDB(query: string): Promise<Content[]> {
  return searchCatalog(query, { sort: 'relevance', limit: 50 });
}

export async function getTrendingMovies(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const movies = filterByType(catalog, 'movie');
  return movies.sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 30);
}

export async function getTrendingTV(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const tv = filterByType(catalog, 'tv');
  if (tv.length === 0) return [];
  return tv.sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 30);
}

export async function getTopRatedMovies(): Promise<Content[]> {
  return getTrendingMovies();
}

export async function getTopRatedTV(): Promise<Content[]> {
  return getTrendingTV();
}

export async function getTop10(): Promise<Content[]> {
  const trending = await getTrendingMovies();
  return trending.slice(0, 10);
}

export async function getByGenre(type: 'movie' | 'tv' | 'all', genreId: number, limit = 50): Promise<Content[]> {
  const catalog = await loadCatalog();
  const filtered = filterByType(catalog, type).filter(item => matchesGenre(item, genreId));
  return filtered.slice(0, limit);
}

export async function getRecommendations(contentId: number | string): Promise<Content[]> {
  const catalog = await loadCatalog();
  const seed = catalog.find(c => c.id === contentId.toString());
  if (!seed) return sample(catalog, 20);
  const candidates = catalog.filter(c => c.id !== seed.id);
  const shared = candidates.filter(c =>
    (c.genres || []).some(g => seed.genres?.includes(g)) ||
    (c.countries || []).some(ct => seed.countries?.includes(ct))
  );
  return (shared.length ? shared : candidates).slice(0, 20);
}

export async function getUpcomingMovies(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const recent = catalog.filter(c => (c.year || 0) >= 2015);
  return recent.slice(0, 30);
}

export async function getCriticallyAcclaimed(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const classics = catalog.filter(c => (c.year || 0) <= 1965);
  return classics.slice(0, 30);
}

export async function getHiddenGems(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const silentEra = catalog.filter(c => (c.year || 0) < 1940);
  return sample(silentEra.length ? silentEra : catalog, 30);
}

export async function getTrendingToday(): Promise<Content[]> {
  const catalog = await loadCatalog();
  return sample(catalog, 20);
}

export async function getMoviesByActor(actorName: string): Promise<{ actor: string; content: Content[]; profilePath: string | null } | null> {
  return null;
}

export async function findCollectionByMovie(movieId: number): Promise<{ name: string; content: Content[] } | null> {
  return null;
}

export async function getRecentlyAdded(): Promise<Content[]> {
  const catalog = await loadCatalog();
  return catalog.sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 30);
}

export async function getForYouContent(): Promise<Content[]> {
  const catalog = await loadCatalog();
  return sample(catalog, 40);
}

export async function getRegionalContent(region: RegionKey): Promise<Content[]> {
  const catalog = await loadCatalog();
  const labels = REGION_COUNTRY_LABELS[region] || [];
  const filtered = catalog.filter(c => (c.countries || []).some(country => labels.includes(country)));
  return (filtered.length ? filtered : sample(catalog, 20)).slice(0, 30);
}

export async function getFemaleDirectedContent(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const femaleHints = catalog.filter(c =>
    (c.directors || []).some(d => /\b(agnes|lopez|ruth|dorothy|lois|alice|maya|chantal|cleo|varda|wertmuller|campion|gerwig|wilder|solntseva|dovzhenko)\b/i.test(d))
  );
  return (femaleHints.length ? femaleHints : sample(catalog, 20)).slice(0, 20);
}

export async function getLGBTContent(): Promise<Content[]> {
  const catalog = await loadCatalog();
  const lgbt = catalog.filter(c => /lgbt|gay|lesbian|queer/i.test(c.description || ''));
  return (lgbt.length ? lgbt : sample(catalog, 20)).slice(0, 20);
}

export async function getScienceFictionContent(limit = 20): Promise<Content[]> {
  return getByGenre('all', 878, limit);
}

export async function getRomanticComedyContent(limit = 20): Promise<Content[]> {
  return getByGenre('all', 10749, limit);
}

export async function getHiddenGemsByGenre(genreId: number): Promise<Content[]> {
  const byGenre = await getByGenre('all', genreId, 100);
  return sample(byGenre, 20);
}

export async function getBecauseYouWatched(contentId: string): Promise<Content[]> {
  return getRecommendations(contentId);
}

export async function getForMood(mood: MoodKey): Promise<{ title: string; items: Content[] }> {
  const genreMap: Record<MoodKey, number[]> = {
    action: [28, 12, 10752],
    comedy: [35],
    dark: [27, 53],
    family: [10751, 16],
  };
  const items = await getByGenre('all', genreMap[mood][0], 40);
  return { title: mood.toUpperCase(), items };
}

export async function getForYouByCategories(categories: string[]): Promise<Content[]> {
  const catalog = await loadCatalog();
  const lowerCats = categories.map(c => c.toLowerCase());
  const filtered = catalog.filter(c =>
    lowerCats.some(cat =>
      normalize([c.genres?.join(' '), c.description, c.countries?.join(' ')].filter(Boolean).join(' ')).includes(cat)
    )
  );
  return (filtered.length ? filtered : sample(catalog, 30)).slice(0, 30);
}

export async function getBecauseOfContinueWatching(): Promise<Content[]> {
  return getForYouContent();
}

export async function getForPlan(planId: string): Promise<Content[]> {
  if (/doc|history|war/i.test(planId)) return getByGenre('all', 99, 30);
  if (/sci|space/i.test(planId)) return getScienceFictionContent(30);
  return getForYouContent();
}

export function buildLocalFallback(): Content[] {
  return [
    {
      id: 'fallback-1',
      title: 'Public Domain Classics',
      type: 'movie',
      poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Placeholder_view_vector.svg/640px-Placeholder_view_vector.svg.png',
      backdrop: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Placeholder_view_vector.svg/640px-Placeholder_view_vector.svg.png',
      description: 'Static fallback item when catalog is unavailable.',
      videoUrl: undefined,
      genres: [],
      cast: [],
    },
  ];
}
