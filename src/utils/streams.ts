import { StreamsResponse, StreamCategory, Stream } from '@/types';

// Sports streams API - update with your actual base domain if different
// The API endpoint is /api/streams - we just need the base domain
const STREAMS_API_BASE = import.meta.env.VITE_STREAMS_API_URL || 'https://ppv.to';
const STREAMS_API_URL = `${STREAMS_API_BASE}/api/streams`;

const CACHE_DURATION = 90000; // 1.5 minute cache - slightly longer to reduce API calls

let cachedResponse: StreamsResponse | null = null;
let cacheTimestamp: number = 0;

// Check if API URL is configured (not using placeholder)
const isApiConfigured = (): boolean => {
  // If it's a real domain (not placeholder), it's configured
  return STREAMS_API_BASE.includes('http') && 
         !STREAMS_API_BASE.includes('your-api-domain');
};

export const getStreams = async (): Promise<StreamsResponse> => {
  // Check if API is configured
  if (!isApiConfigured()) {
    throw new Error('API_URL_NOT_CONFIGURED');
  }

  const now = Date.now();
  
  // Return cached response if still valid
  if (cachedResponse && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedResponse;
  }

  try {
    const response = await fetch(STREAMS_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Don't cache the fetch request itself - we handle caching manually
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText);
      throw new Error(`Failed to fetch streams: ${response.status} ${response.statusText}`);
    }

    const data: StreamsResponse = await response.json();
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid API response: expected object');
    }
    
    if (!Array.isArray(data.streams)) {
      console.warn('API response missing streams array, using empty array');
      data.streams = [];
    }
    
    // Validate each stream category
    if (data.streams && Array.isArray(data.streams)) {
      data.streams = data.streams.filter((cat: StreamCategory) => {
        if (!cat || typeof cat !== 'object') return false;
        if (!cat.category || typeof cat.category !== 'string') return false;
        if (!Array.isArray(cat.streams)) {
          cat.streams = [];
        }
        return true;
      });
    }
    
    // Cache the validated response
    cachedResponse = data;
    cacheTimestamp = now;
    
    return data;
  } catch (error: any) {
    console.error('Error fetching streams:', error);
    
    // Return cached response even if expired (better than nothing)
    if (cachedResponse) {
      console.warn('Using cached response due to fetch error');
      return cachedResponse;
    }
    
    // Re-throw with more context
    if (error.message === 'Failed to fetch') {
      throw new Error('Failed to fetch streams: Network error or CORS issue');
    }
    throw error;
  }
};

// Channel/network streams that aren't actual matchups (should be filtered from live sports)
const CHANNEL_STREAM_KEYWORDS = [
  'redzone', 'red zone', 'red-zone',
  'network', '24/7', 'channel',
  'highlights', 'recap', 'wrap-up',
  'nfl network', 'espn news', 'sportscenter'
];

// Check if a stream is a channel/network rather than an actual matchup
export const isChannelStream = (streamName: string): boolean => {
  const lower = streamName.toLowerCase();
  return CHANNEL_STREAM_KEYWORDS.some(keyword => lower.includes(keyword));
};

// Valid sports categories - filter out non-sports content
const SPORTS_CATEGORIES = [
  'Basketball', 'Football', 'Soccer', 'Baseball', 'Hockey', 'Tennis',
  'Combat Sports', 'MMA', 'Boxing', 'Wrestling', 'UFC', 'Boxing',
  'Racing', 'Formula 1', 'NASCAR', 'Motorsports',
  'Golf', 'Soccer', 'Rugby', 'Cricket', 'Volleyball'
];

const isSportsCategory = (categoryName: string): boolean => {
  const lower = categoryName.toLowerCase();
  return SPORTS_CATEGORIES.some(sport => lower.includes(sport.toLowerCase())) ||
         !lower.includes('24/7') && 
         !lower.includes('cows') && 
         !lower.includes('south park') &&
         !lower.includes('family guy') &&
         !lower.includes('simpsons') &&
         !lower.includes('test');
};

export const getLiveStreams = async (): Promise<Stream[]> => {
  const response = await getStreams();
  const now = Math.floor(Date.now() / 1000);
  
  const liveStreams: Stream[] = [];
  
  response.streams.forEach((category: StreamCategory) => {
    // Only process sports categories
    if (!isSportsCategory(category.category)) return;
    
    category.streams.forEach((stream: Stream) => {
      // Validate stream object
      if (!stream || typeof stream !== 'object') return;
      if (!stream.name || typeof stream.name !== 'string') return;
      
      // Only include streams that are actually live RIGHT NOW
      // always_live = 1 means it's always live
      // Otherwise check if current time is between starts_at and ends_at
      const isLive = stream.always_live === 1 || 
                     (stream.starts_at && stream.ends_at && 
                      stream.starts_at <= now && stream.ends_at >= now);
      
      // Only include sports streams with iframe
      // Exclude channel/network streams (like RedZone) - only show actual matchups
      if (isLive && stream.iframe && typeof stream.iframe === 'string' && stream.iframe.trim() && 
          stream.category_name && isSportsCategory(stream.category_name) &&
          !isChannelStream(stream.name)) {
        liveStreams.push(stream);
      }
    });
  });
  
  return liveStreams;
};

export const getStreamsByCategory = async (categoryName: string): Promise<Stream[]> => {
  const response = await getStreams();
  
  const category = response.streams.find(
    cat => cat.category.toLowerCase() === categoryName.toLowerCase()
  );
  
  return category?.streams || [];
};

export const formatStreamTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const isStreamLive = (stream: Stream): boolean => {
  if (!stream || typeof stream !== 'object') return false;
  const now = Math.floor(Date.now() / 1000);
  
  // Check if always live
  if (stream.always_live === 1) return true;
  
  // Check if current time is within stream duration
  if (stream.starts_at && stream.ends_at) {
    return stream.starts_at <= now && stream.ends_at >= now;
  }
  
  return false;
};

export const isStreamUpcoming = (stream: Stream): boolean => {
  if (!stream || typeof stream !== 'object') return false;
  if (!stream.starts_at) return false;
  
  const now = Math.floor(Date.now() / 1000);
  
  // Stream is upcoming if it starts in the future but within next 24 hours
  return stream.starts_at > now && stream.starts_at <= now + 86400;
};

export const getUpcomingStreams = async (): Promise<Stream[]> => {
  const response = await getStreams();
  const now = Math.floor(Date.now() / 1000);
  
  const upcomingStreams: Stream[] = [];
  
  response.streams.forEach((category: StreamCategory) => {
    // Only process sports categories
    if (!isSportsCategory(category.category)) return;
    
    category.streams.forEach((stream: Stream) => {
      // Validate stream object
      if (!stream || typeof stream !== 'object') return;
      if (!stream.name || typeof stream.name !== 'string') return;
      
      // Check if stream is upcoming (within next 24 hours, but not started yet)
      const isUpcoming = stream.starts_at && 
                         stream.starts_at > now && 
                         stream.starts_at <= now + 86400; // Next 24 hours
      
      // Only include sports streams with iframe
      // Exclude channel/network streams (like RedZone) - only show actual matchups
      if (isUpcoming && stream.iframe && typeof stream.iframe === 'string' && stream.iframe.trim() && 
          stream.category_name && isSportsCategory(stream.category_name) &&
          !isChannelStream(stream.name)) {
        upcomingStreams.push(stream);
      }
    });
  });
  
  // Sort by start time (soonest first)
  return upcomingStreams.sort((a, b) => (a.starts_at || 0) - (b.starts_at || 0));
};

