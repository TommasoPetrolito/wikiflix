import { Content, Stream } from '@/types';
import {
  searchByTitle,
  fetchRandomSet,
  fetchPopular,
  fetchRecentlyAdded,
  fetchByGenre,
  fetchRelatedByCastOrGenre,
  WikidataMedia,
} from '@/services/wikidataService';

// Map TMDB genre IDs to Wikidata genre Q-ids (best-effort)
const GENRE_MAP: Record<number, string> = {
  28: 'Q188473', // Action film
  35: 'Q157443', // Comedy film
  27: 'Q200092', // Horror film
  53: 'Q2484376', // Thriller film
  16: 'Q1107', // Animation
  10751: 'Q21936849', // Family film
  10762: 'Q845060', // Children's television series
  80: 'Q859369', // Crime film (proxy for moody TV)
};

const FALLBACK_POSTER = 'https://via.placeholder.com/600x900?text=Wikiflix';
const FALLBACK_BACKDROP = 'https://via.placeholder.com/1280x720?text=Wikiflix';

const mapMediaToContent = (m: WikidataMedia): Content => ({
  id: m.id,
  title: m.title,
  type: 'movie',
  year: m.year,
  poster: m.poster || FALLBACK_POSTER,
  backdrop: m.poster || FALLBACK_BACKDROP,
  description: m.description || 'Public domain movie from Wikidata',
  videoUrl: m.videoUrl,
  subtitles: m.subtitles,
});

// --- Adapters matching the previous TMDB API surface ---
export const searchTMDB = async (query: string): Promise<Content[]> => {
  const items = await searchByTitle(query, 40);
  return items.map(mapMediaToContent);
};

export const getTrendingMovies = async (): Promise<Content[]> => {
  const items = await fetchPopular(60);
  return items.map(mapMediaToContent);
};

export const getTopRatedMovies = getTrendingMovies;
export const getTopRatedTV = getTrendingMovies;
export const getTrendingTV = getTrendingMovies;

export const getTop10 = async (): Promise<Content[]> => {
  const items = await fetchPopular(10);
  return items.map(mapMediaToContent);
};

export const getByGenre = async (_mediaType: 'movie' | 'tv', genreId: number, limit = 40): Promise<Content[]> => {
  const qid = GENRE_MAP[genreId];
  if (!qid) return [];
  const items = await fetchByGenre(qid, limit);
  return items.map(mapMediaToContent);
};

export const getRecommendations = async (_type: 'movie' | 'tv', anchorId: number | string): Promise<Content[]> => {
  const items = await fetchRelatedByCastOrGenre(String(anchorId), 40);
  return items.map(mapMediaToContent);
};

export const getUpcomingMovies = async (): Promise<Content[]> => {
  const items = await fetchRecentlyAdded(40);
  return items.map(mapMediaToContent);
};

export const getCriticallyAcclaimed = async (): Promise<Content[]> => {
  const items = await fetchPopular(40);
  return items.map(mapMediaToContent);
};

export const getHiddenGems = async (): Promise<Content[]> => {
  const items = await fetchRandomSet(40);
  return items.map(mapMediaToContent);
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
  const items = await fetchRecentlyAdded(40);
  return items.map(mapMediaToContent);
};

// For You content placeholder – can be wired to a curated/random set
export const getForYouContent = async (): Promise<Content[]> => {
  const items = await fetchRandomSet(30);
  return items.map(mapMediaToContent);
};

// Live streams are out of scope for Wikidata; return empty
export const getLiveStreams = async (): Promise<Stream[]> => [];

// Helper to fetch a hero item
export const getHeroCandidate = async (): Promise<Content | null> => {
  const items = await fetchRandomSet(1);
  return items.length ? mapMediaToContent(items[0]) : null;
};

// Bulk fetch for home rows
export const getHomeBatches = async () => {
  const [popular, recent, random] = await Promise.all([
    fetchPopular(40),
    fetchRecentlyAdded(40),
    fetchRandomSet(40),
  ]);
  return {
    popular: popular.map(mapMediaToContent),
    recent: recent.map(mapMediaToContent),
    random: random.map(mapMediaToContent),
  };
};
