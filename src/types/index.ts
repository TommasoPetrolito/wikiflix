export interface Content {
  id: string; // Wikidata Q-id
  title: string;
  type: 'movie' | 'tv';
  year?: number;
  poster: string;
  backdrop: string;
  description: string;
  descriptionLong?: string;
  videoUrl?: string;
  subtitles?: string;
  subtitleTracks?: Array<{ src: string; lang?: string; label?: string }>;
  wikidataId?: string;
  titleLabels?: Record<string, string>;
  commonsLink?: string;
  wikipediaUrl?: string;
  altVideos?: Array<{ kind: 'commons' | 'youtube' | 'archive' | 'libreflix' | 'vimeo'; url: string; label?: string; lang?: string }>;
  language?: string;
  license?: string;
  durationSeconds?: number;
  isTrailer?: boolean;
  genres?: string[];
  cast?: string[];
  directors?: string[];
  countries?: string[];
  descriptions?: Record<string, string>;
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

export type Category = 'all' | 'movies';

