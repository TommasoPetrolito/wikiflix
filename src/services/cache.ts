const CACHE_PREFIX = 'wikiflix_cache:';

interface CachedEntry<T> {
  timestamp: number;
  ttl: number;
  data: T;
}

const isLocalStorageAvailable = () => {
  try {
    const testKey = `${CACHE_PREFIX}__test`;
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

export const setCached = <T>(key: string, data: T, ttlMs: number) => {
  if (!isLocalStorageAvailable()) return;
  const entry: CachedEntry<T> = {
    timestamp: Date.now(),
    ttl: ttlMs,
    data,
  };
  window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
};

export const getCached = <T>(key: string): T | null => {
  if (!isLocalStorageAvailable()) return null;
  const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CachedEntry<T>;
    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.data;
  } catch {
    window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    return null;
  }
};

export const clearCached = (key: string) => {
  if (!isLocalStorageAvailable()) return;
  window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
};
