import { WatchProgress, Content } from '@/types';

export const saveProgress = (progress: WatchProgress): void => {
  const key = `progress_${progress.mediaType}_${progress.id}`;
  localStorage.setItem(key, JSON.stringify(progress));
};

export const getProgress = (id: string | number, mediaType: 'movie' | 'tv'): WatchProgress | null => {
  const key = `progress_${mediaType}_${id}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

export const updateEpisodeInfo = (id: string | number, season: number, episode: number): void => {
  const key = `progress_tv_${id}`;
  const existing = localStorage.getItem(key);
  
  if (existing) {
    const progress = JSON.parse(existing);
    progress.season = season;
    progress.episode = episode;
    localStorage.setItem(key, JSON.stringify(progress));
  }
};

export const saveContinueWatching = (content: Content[]): void => {
  localStorage.setItem('continueWatching', JSON.stringify(content));
};

export const getContinueWatching = (): Content[] => {
  const data = localStorage.getItem('continueWatching');
  return data ? JSON.parse(data) : [];
};

export const addToContinueWatching = (content: Content): void => {
  let watching = getContinueWatching();
  
  // Remove if already exists
  watching = watching.filter(item => !(item.id === content.id && item.type === content.type));
  
  // Add to beginning
  watching.unshift(content);
  
  // Keep only last 12
  if (watching.length > 12) {
    watching = watching.slice(0, 12);
  }
  
  saveContinueWatching(watching);
};

// One-time data migration for known incorrect IDs in older builds
export const migrateKnownFixes = (): void => {
  // Fix The Sopranos TMDB id (was 2288 -> correct 1398)
  const oldSopranosId = 2288;
  const newSopranosId = 1398;

  // Continue Watching list
  const cw = getContinueWatching();
  let changed = false;
  const migrated = cw.map((item) => {
    if (item.type === 'tv' && item.title === 'The Sopranos' && item.id !== newSopranosId) {
      changed = true;
      return { ...item, id: newSopranosId } as Content;
    }
    return item;
  });
  if (changed) saveContinueWatching(migrated);

  // Progress keys
  try {
    const oldKey = `progress_tv_${oldSopranosId}`;
    const newKey = `progress_tv_${newSopranosId}`;
    const oldData = localStorage.getItem(oldKey);
    const hasNew = localStorage.getItem(newKey);
    if (oldData && !hasNew) {
      const parsed = JSON.parse(oldData);
      parsed.id = newSopranosId;
      localStorage.setItem(newKey, JSON.stringify(parsed));
      localStorage.removeItem(oldKey);
    }
  } catch {
    // ignore
  }
};

// Intro markers per TV show (user-defined once)
export interface IntroMarkers {
  start: number; // seconds
  end: number;   // seconds
}

export const getIntroMarkers = (tvId: string | number): IntroMarkers | null => {
  const data = localStorage.getItem(`intro_markers_${tvId}`);
  return data ? JSON.parse(data) : null;
};

export const saveIntroMarkers = (tvId: string | number, markers: IntroMarkers): void => {
  if (markers.end <= markers.start) return; // basic guard
  localStorage.setItem(`intro_markers_${tvId}`, JSON.stringify(markers));
};

export const clearIntroMarkers = (tvId: string | number): void => {
  localStorage.removeItem(`intro_markers_${tvId}`);
};

// --- My List (Favorites) ---
const MY_LIST_KEY = 'my_list_items';

export const getMyList = (): Content[] => {
  const data = localStorage.getItem(MY_LIST_KEY);
  return data ? (JSON.parse(data) as Content[]) : [];
};

export const isInMyList = (content: Content): boolean => {
  const list = getMyList();
  return list.some((i) => i.id === content.id && i.type === content.type);
};

export const addToMyList = (content: Content): void => {
  const list = getMyList();
  if (!list.some((i) => i.id === content.id && i.type === content.type)) {
    const updated = [content, ...list].slice(0, 100);
    localStorage.setItem(MY_LIST_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('flux:list:changed'));
  }
};

export const removeFromMyList = (content: Content): void => {
  const list = getMyList();
  const updated = list.filter((i) => !(i.id === content.id && i.type === content.type));
  localStorage.setItem(MY_LIST_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('flux:list:changed'));
};

export const toggleMyList = (content: Content): boolean => {
  if (isInMyList(content)) {
    removeFromMyList(content);
    return false;
  } else {
    addToMyList(content);
    return true;
  }
};

