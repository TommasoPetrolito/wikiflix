import { Content } from '@/types';
import { getProgress } from './storage';

/**
 * Vidking domain fallback list - tries multiple domains if one is down
 * Note: Vidking is a third-party streaming service
 * The developer has no control or responsibility for content provided by Vidking.
 */
const VIDKING_DOMAINS = [
  'www.vidking.net',
  'vidking1.net',
  'vidking2.net',
  'vidking3.net',
  'vidking.net',
];

/**
 * Get the active streaming provider (Vidking or VidSrc)
 */
export const getStreamingProvider = (): 'vidking' | 'vidsrc' => {
  const saved = localStorage.getItem('streaming_provider');
  if (saved === 'vidking' || saved === 'vidsrc') return saved;
  return 'vidsrc'; // Default to VidSrc (more reliable)
};

/**
 * Set the active streaming provider
 */
export const setStreamingProvider = (provider: 'vidking' | 'vidsrc'): void => {
  localStorage.setItem('streaming_provider', provider);
};

/**
 * Get the active Vidking domain (with fallback support)
 * Checks localStorage for user preference, otherwise uses first available
 */
export const getVidkingDomain = (): string => {
  const saved = localStorage.getItem('vidking_domain');
  if (saved && VIDKING_DOMAINS.includes(saved)) {
    return saved;
  }
  return VIDKING_DOMAINS[0];
};

/**
 * Set the active Vidking domain (for fallback switching)
 */
export const setVidkingDomain = (domain: string): void => {
  if (VIDKING_DOMAINS.includes(domain)) {
    localStorage.setItem('vidking_domain', domain);
  }
};

/**
 * Get all Vidking domains for fallback attempts
 */
export const getVidkingDomains = (): string[] => {
  return [...VIDKING_DOMAINS];
};

/**
 * Builds Vidking embed URL for content.
 * Note: Vidking is a third-party streaming service (vidking.net, vidking1.net, vidking2.net, etc.)
 * The developer has no control or responsibility for content provided by Vidking.
 * Our postMessage handlers accept messages from any vidking domain.
 */
export const buildVidkingUrl = (content: Content, forceSeason?: number, forceEpisode?: number, domainOverride?: string): string => {
  // Map known legacy IDs to correct TMDB IDs
  const legacyMap: Record<string, number> = {
    'tv:2288': 1398, // Sopranos
  };
  const mappedId = legacyMap[`${content.type}:${content.id}`] ?? content.id;

  const domain = domainOverride || getVidkingDomain();
  let url = `https://${domain}/embed/${content.type}/${mappedId}`;
  
  if (import.meta.env.DEV) {
    console.log(`[Vidking] Building URL for ${content.type}/${mappedId} on ${domain}:`, url);
  }
  
  // For TV shows, use saved episode/season info or provided values
  if (content.type === 'tv') {
    // If season/episode are explicitly provided (user clicked a specific episode), use those
    // Otherwise, use saved progress, then content defaults, then 1/1
    const season = forceSeason ?? (content.season ?? getProgress(mappedId, content.type)?.season ?? 1);
    const episode = forceEpisode ?? (content.episode ?? getProgress(mappedId, content.type)?.episode ?? 1);

    url += `/${season}/${episode}`;
  }
  
  const params = new URLSearchParams({
    color: 'e50914', // Netflix red
    autoPlay: 'true',
    subtitle: 'en', // Auto English subtitles
    subtitleLang: 'en', // English subtitle language
    cc: 'true', // Enable closed captions
    captions: 'true', // Enable captions
  });
  
  if (content.type === 'tv') {
    params.append('nextEpisode', 'true');
    params.append('episodeSelector', 'true');
  }
  
  // Resume from last position if available (only after meaningful watch time)
  const progress = getProgress(mappedId, content.type);
  if (progress) {
    // Ignore tiny previews: require at least 60s watched to resume
    const minimumResumeSeconds = 60;
    let resumeAt = Math.floor(progress.currentTime || 0);

    // If user nearly finished, resume at last minute instead of 99% to avoid instant end
    if (progress.duration && progress.progress > 95) {
      resumeAt = Math.max(0, Math.floor(progress.duration - 60));
    }

    if (resumeAt >= minimumResumeSeconds) {
      // For resumes > 5 minutes, don't use URL progress parameter
      // PlayerModal will handle seeking via postMessage after player is ready
      // This prevents audio/video desync and buffering issues
      if (resumeAt > 300) { // > 5 minutes
        // Don't add progress param - PlayerModal will seek after ready
        // Just let player load from start
      } else {
        // For short resumes (<5min), URL param is fine
        params.append('progress', resumeAt.toString());
      }
    }
  }
  
  return `${url}?${params.toString()}`;
};

// Lightweight preview URL: starts from 0, no resume, minimal params
export const buildVidkingPreviewUrl = (content: Content, domainOverride?: string): string => {
  const legacyMap: Record<string, number> = {
    'tv:2288': 1398,
  };
  const mappedId = legacyMap[`${content.type}:${content.id}`] ?? content.id;

  const domain = domainOverride || getVidkingDomain();
  let url = `https://${domain}/embed/${content.type}/${mappedId}`;

  if (content.type === 'tv') {
    // Use saved season/episode if available (for correct episode), but do not resume time
    const progress = getProgress(mappedId, content.type);
    const season = (progress?.season ?? content.season ?? 1);
    const episode = (progress?.episode ?? content.episode ?? 1);
    url += `/${season}/${episode}`;
  }

  const params = new URLSearchParams({
    color: 'e50914',
    autoPlay: 'true',
    muted: '1',
  });
  // No nextEpisode/episodeSelector to keep player light; no progress param
  return `${url}?${params.toString()}`;
};

