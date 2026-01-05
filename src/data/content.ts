import { Content } from '@/types';

// Legacy TMDB seed data removed in favor of Wikidata-first flow. Stub arrays retained to satisfy exports.
export const trendingMovies: Content[] = [];
export const popularTV: Content[] = [];
export const actionMovies: Content[] = [];

export const getPosterUrl = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;
export const getBackdropUrl = (path: string) => `https://image.tmdb.org/t/p/original${path}`;
