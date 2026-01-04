export interface Content {
  id: string | number; // Wikidata Q-id (string) or legacy numeric TMDB id
  title: string;
  type: 'movie' | 'tv';
  year?: number;
  poster: string;
  backdrop: string;
  description: string;
  season?: number;
  episode?: number;
}

export interface WatchProgress {
  id: string | number;
  mediaType: 'movie' | 'tv';
  currentTime: number;
  duration: number;
  progress: number;
  lastWatched: number;
  season?: number;
  episode?: number;
}

export interface PlayerEvent {
  type: 'PLAYER_EVENT';
  data: {
    event: 'timeupdate' | 'play' | 'pause' | 'ended' | 'seeked';
    currentTime: number;
    duration: number;
    progress: number;
    id: string;
    mediaType: 'movie' | 'tv';
    season?: number;
    episode?: number;
    timestamp: number;
  };
}

export type Category = 'all' | 'movies' | 'tv' | 'sports';

export interface Stream {
  id: number;
  name: string;
  tag: string;
  poster: string;
  uri_name: string;
  starts_at: number;
  ends_at: number;
  always_live: number;
  category_name: string;
  iframe?: string;
  allowpaststreams: number;
}

export interface StreamCategory {
  category: string;
  id: number;
  always_live: number;
  streams: Stream[];
}

export interface StreamsResponse {
  success: boolean;
  timestamp: number;
  READ_ME: string;
  performance: number;
  streams: StreamCategory[];
}

