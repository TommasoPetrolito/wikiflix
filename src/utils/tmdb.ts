import { Content } from '@/types';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  media_type?: string;
  vote_average?: number;
  vote_count?: number;
}

export interface TMDBShow {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  media_type?: string;
  vote_average?: number;
  vote_count?: number;
}

// Convert TMDB results to our Content format
const convertTMDBToContent = (item: TMDBMovie | TMDBShow, type: 'movie' | 'tv'): Content => {
  const isMovie = type === 'movie';
  const title = isMovie ? (item as TMDBMovie).title : (item as TMDBShow).name;
  const year = parseInt(
    isMovie 
      ? (item as TMDBMovie).release_date?.split('-')[0] || '0'
      : (item as TMDBShow).first_air_date?.split('-')[0] || '0'
  );

  return {
    id: item.id,
    title,
    type,
    year,
    poster: item.poster_path || '/placeholder.jpg',
    backdrop: item.backdrop_path || '/placeholder.jpg',
    description: item.overview || 'No description available',
    season: type === 'tv' ? 1 : undefined,
    episode: type === 'tv' ? 1 : undefined,
  };
};

// Person/Actor interface
export interface TMDBActor {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  known_for?: Array<{
    id: number;
    title?: string;
    name?: string;
    media_type: string;
    poster_path: string | null;
  }>;
}

// Detailed Person interface
export interface TMDBPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  also_known_as?: string[];
}

// Search results interface
export interface SearchResults {
  content: Content[];
  actors: TMDBActor[];
}

// Search for movies, TV shows, and actors
export const searchTMDB = async (query: string): Promise<Content[]> => {
  if (!query.trim()) return [];
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY not set. Please add it to your .env file');
    return [];
  }

  try {
    // Search both movies and TV shows
    const [moviesRes, showsRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      ),
      fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      ),
    ]);

    const moviesData = await moviesRes.json();
    const showsData = await showsRes.json();

    const movies = (moviesData.results || [])
      .filter((m: TMDBMovie) => m.poster_path) // Only include items with posters
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));

    const shows = (showsData.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));

    // Combine and sort by popularity (movies first, then shows)
    return [...movies, ...shows].slice(0, 50); // Limit to 50 results for performance
  } catch (error) {
    console.error('Error searching TMDB:', error);
    return [];
  }
};

// Search for everything including actors
export const searchTMDBWithActors = async (query: string): Promise<SearchResults> => {
  if (!query.trim()) return { content: [], actors: [] };
  if (!TMDB_API_KEY) {
    console.error('TMDB_API_KEY not set. Please add it to your .env file');
    return { content: [], actors: [] };
  }

  try {
    const queryLength = query.trim().length;
    const trimmedQuery = query.trim().toLowerCase();
    const firstLetter = trimmedQuery[0];
    
    // Search movies, TV shows
    const [moviesRes, showsRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      ),
      fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
      ),
    ]);

    let allPeopleResults: any[] = [];
    
    // For very short queries (1-2 chars), use Popular People endpoint and filter by first letter
    // This ensures we get the most well-known actors, not just what search returns
    if (queryLength <= 2) {
      // Fetch multiple pages of popular people (up to 10 pages = ~200 people)
      const popularPeoplePages = 10;
      const popularPeopleResArray = await Promise.all(
        Array.from({ length: popularPeoplePages }, (_, i) =>
          fetch(
            `${TMDB_BASE_URL}/person/popular?api_key=${TMDB_API_KEY}&page=${i + 1}`
          )
        )
      );
      
      const popularPeopleDataArray = await Promise.all(popularPeopleResArray.map(res => res.json()));
      const allPopularPeople = popularPeopleDataArray.flatMap(data => data.results || []);
      
      // Filter by first letter (case-insensitive)
      allPeopleResults = allPopularPeople.filter((p: any) => 
        p.name && p.name.trim().toLowerCase()[0] === firstLetter
      );
      
      console.log(`\n=== Search "${query}" Strategy: Popular People ===`);
      console.log(`Fetched ${allPopularPeople.length} popular people, filtered to ${allPeopleResults.length} starting with "${firstLetter}"`);
      
      // Check if Adam Sandler is in results
      const adamSandler = allPeopleResults.find((p: any) => 
        p.name?.toLowerCase().includes('adam') && p.name?.toLowerCase().includes('sandler')
      );
      const alPacino = allPeopleResults.find((p: any) => 
        p.name?.toLowerCase().includes('al') && p.name?.toLowerCase().includes('pacino')
      );
      
      console.log(`Adam Sandler found:`, adamSandler ? `${adamSandler.name} (popularity: ${adamSandler.popularity})` : 'NOT FOUND');
      console.log(`Al Pacino found:`, alPacino ? `${alPacino.name} (popularity: ${alPacino.popularity})` : 'NOT FOUND');
      console.log(`Top 10 by popularity:`, allPeopleResults
        .filter((p: any) => p.profile_path)
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 10)
        .map((p: any) => `${p.name} (${(p.popularity || 0).toFixed(1)})`));
      console.log(`========================\n`);
    } else {
      // For longer queries, use normal search
      const personPages = queryLength <= 3 ? 5 : 1;
      const peopleResArray = await Promise.all(
        Array.from({ length: personPages }, (_, i) =>
          fetch(
            `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${i + 1}`
          )
        )
      );
      
      const peopleDataArray = await Promise.all(peopleResArray.map(res => res.json()));
      allPeopleResults = peopleDataArray.flatMap(data => data.results || []);
    }

    const moviesData = await moviesRes.json();
    const showsData = await showsRes.json();

    const movies = (moviesData.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));

    const shows = (showsData.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));

    // Filter actors with photos, remove duplicates, sort by popularity, then limit
    const seenIds = new Set<number>();
    const actors = allPeopleResults
      .filter((p: TMDBActor & { popularity?: number }) => {
        // Only include actors with photos and not already seen
        if (!p.profile_path || seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      })
      .sort((a: TMDBActor & { popularity?: number }, b: TMDBActor & { popularity?: number }) => {
        // Sort by popularity descending (higher popularity first)
        const aPop = a.popularity || 0;
        const bPop = b.popularity || 0;
        return bPop - aPop;
      })
      .slice(0, 20) // Limit to top 20 most popular actors
      .map((p: TMDBActor & { popularity?: number }) => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path,
        known_for_department: p.known_for_department || 'Acting',
        popularity: p.popularity || 0,
        known_for: p.known_for || [],
      }));

    return {
      content: [...movies, ...shows].slice(0, 50),
      actors,
    };
  } catch (error) {
    console.error('Error searching TMDB:', error);
    return { content: [], actors: [] };
  }
};

// Get trending movies
export const getTrendingMovies = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 40)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    return [];
  }
};

// Get trending TV shows
export const getTrendingTV = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .slice(0, 40)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));
  } catch (error) {
    console.error('Error fetching trending TV:', error);
    return [];
  }
};

// Get top 10 trending content (movies and TV combined, sorted by popularity)
export const getTop10 = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const [moviesRes, tvRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`),
      fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`),
    ]);

    const moviesData = await moviesRes.json();
    const tvData = await tvRes.json();

    // Combine both, filter for posters, and sort by popularity
    const allContent: Array<Content & { popularity: number }> = [
      ...(moviesData.results || [])
        .filter((m: TMDBMovie & { popularity?: number }) => m.poster_path)
        .map((m: TMDBMovie & { popularity?: number }) => ({
          ...convertTMDBToContent(m, 'movie'),
          popularity: m.popularity || 0,
        })),
      ...(tvData.results || [])
        .filter((s: TMDBShow & { popularity?: number }) => s.poster_path)
        .map((s: TMDBShow & { popularity?: number }) => ({
          ...convertTMDBToContent(s, 'tv'),
          popularity: s.popularity || 0,
        })),
    ];

    // Sort by popularity descending and take top 10
    return allContent
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10)
      .map(({ popularity, ...content }) => content);
  } catch (error) {
    console.error('Error fetching top 10:', error);
    return [];
  }
};

// Get top-rated movies
export const getTopRatedMovies = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 40)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));
  } catch (error) {
    console.error('Error fetching top-rated movies:', error);
    return [];
  }
};

// Get top-rated TV shows
export const getTopRatedTV = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .slice(0, 40)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));
  } catch (error) {
    console.error('Error fetching top-rated TV:', error);
    return [];
  }
};

// Get popular movies
export const getPopularMovies = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 40)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
};

// Get popular TV shows
export const getPopularTV = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .slice(0, 40)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));
  } catch (error) {
    console.error('Error fetching popular TV:', error);
    return [];
  }
};

// Discover by genre (movies or TV), sorted by popularity
export const getByGenre = async (
  type: 'movie' | 'tv',
  genreId: number,
  limit: number = 20,
): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    // Fetch multiple pages if needed (TMDB returns 20 per page)
    const pagesNeeded = Math.ceil(limit / 20);
    const allResults: any[] = [];

    for (let page = 1; page <= pagesNeeded && page <= 3; page++) { // Max 3 pages to avoid too many requests
      const response = await fetch(
        `${TMDB_BASE_URL}/discover/${type}?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`
      );
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        allResults.push(...data.results);
      } else {
        break; // No more results
      }
    }

    const results = allResults
      .filter((item: any) => item.poster_path)
      .slice(0, limit);

    return results.map((item: TMDBMovie | TMDBShow) => convertTMDBToContent(item as any, type));
  } catch (error) {
    console.error(`Error fetching ${type} by genre ${genreId}:`, error);
    return [];
  }
};

// Get upcoming movies
export const getUpcomingMovies = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();

    return (data.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 40)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return [];
  }
};

// Get critically acclaimed (high vote average)
export const getCriticallyAcclaimed = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const [moviesRes, tvRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=500&page=1`),
      fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=300&page=1`),
    ]);

    const moviesData = await moviesRes.json();
    const tvData = await tvRes.json();

    const movies = (moviesData.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 20)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));

    const tv = (tvData.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .slice(0, 20)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));

    return [...movies, ...tv].slice(0, 40);
  } catch (error) {
    console.error('Error fetching critically acclaimed:', error);
    return [];
  }
};

// Hidden Gems: High-rated but low popularity (underrated content)
export const getHiddenGems = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const [moviesRes, tvRes] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=100&vote_count.lte=5000&page=1`),
      fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=50&vote_count.lte=3000&page=1`),
    ]);

    const moviesData = await moviesRes.json();
    const tvData = await tvRes.json();

    const movies = (moviesData.results || [])
      .filter((m: TMDBMovie) => m.poster_path && (m.vote_average ?? 0) >= 7.5)
      .slice(0, 10)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));

    const tv = (tvData.results || [])
      .filter((s: TMDBShow) => s.poster_path && (s.vote_average ?? 0) >= 7.5)
      .slice(0, 10)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));

    return [...movies, ...tv].slice(0, 20);
  } catch (error) {
    console.error('Error fetching hidden gems:', error);
    return [];
  }
};

// Mood-based browsing: Feel-Good (comedy + family)
export const getFeelGood = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];
  try {
    const [comedy, family] = await Promise.all([
      getByGenre('movie', 35, 10), // Comedy
      getByGenre('movie', 10751, 10), // Family
    ]);
    return [...comedy, ...family].slice(0, 20);
  } catch {
    return [];
  }
};

// Thrilling: Action + Thriller
export const getThrilling = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];
  try {
    const [action, thriller] = await Promise.all([
      getByGenre('movie', 28, 10), // Action
      getByGenre('movie', 53, 10), // Thriller
    ]);
    return [...action, ...thriller].slice(0, 20);
  } catch {
    return [];
  }
};

// Thoughtful: Drama + Documentary
export const getThoughtful = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];
  try {
    const [drama, doc] = await Promise.all([
      getByGenre('movie', 18, 10), // Drama
      getByGenre('movie', 99, 10), // Documentary
    ]);
    return [...drama, ...doc].slice(0, 20);
  } catch {
    return [];
  }
};

// Get detailed person information
export const getPersonDetails = async (personId: number): Promise<TMDBPersonDetails | null> => {
  if (!TMDB_API_KEY) return null;
  
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();
    
    if (data.id) {
      return {
        id: data.id,
        name: data.name,
        biography: data.biography || '',
        birthday: data.birthday || null,
        place_of_birth: data.place_of_birth || null,
        profile_path: data.profile_path,
        known_for_department: data.known_for_department || 'Acting',
        popularity: data.popularity || 0,
        also_known_as: data.also_known_as || [],
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching person details:', error);
    return null;
  }
};

// Search for a person (actor/director)
export const searchPerson = async (name: string): Promise<{ id: number; name: string; profile_path: string | null } | null> => {
  if (!TMDB_API_KEY || !name.trim()) return null;
  
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&page=1`
    );
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const person = data.results[0];
      return {
        id: person.id,
        name: person.name,
        profile_path: person.profile_path,
      };
    }
    return null;
  } catch (error) {
    console.error('Error searching for person:', error);
    return null;
  }
};

// Get content by person (actor/director)
export const getContentByPerson = async (personId: number, type?: 'movie' | 'tv'): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];
  
  try {
    const url = type 
      ? `${TMDB_BASE_URL}/person/${personId}/${type}_credits?api_key=${TMDB_API_KEY}`
      : `${TMDB_BASE_URL}/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    const results = type 
      ? (data.cast || []).slice(0, 20)
      : [...(data.cast || []), ...(data.crew || [])].slice(0, 20);
    
    const content = results
      .filter((item: any) => item.poster_path)
      .map((item: any) => {
        const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
        return convertTMDBToContent(item, mediaType as 'movie' | 'tv');
      });
    
    // Deduplicate by id and type
    const seen = new Set<string>();
    const unique: Content[] = [];
    for (const item of content) {
      const key = `${item.type}-${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique.slice(0, 20);
  } catch (error) {
    console.error('Error fetching content by person:', error);
    return [];
  }
};

// Get movies by actor name (searches person first, then gets their movies)
export const getMoviesByActor = async (actorName: string): Promise<{ actor: string; content: Content[]; profilePath: string | null } | null> => {
  const person = await searchPerson(actorName);
  if (!person) return null;
  
  const content = await getContentByPerson(person.id, 'movie');
  return { actor: person.name, content, profilePath: person.profile_path };
};

// Get movie collection (franchise) by collection ID
export const getCollection = async (collectionId: number): Promise<{ name: string; content: Content[] } | null> => {
  if (!TMDB_API_KEY) return null;
  
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();
    
    if (!data.parts || data.parts.length === 0) return null;
    
    const content = data.parts
      .filter((item: any) => item.poster_path)
      .map((item: TMDBMovie) => convertTMDBToContent(item, 'movie'));
    
    return {
      name: data.name,
      content,
    };
  } catch (error) {
    console.error('Error fetching collection:', error);
    return null;
  }
};

// Search for collections by movie title (finds the collection a movie belongs to)
export const findCollectionByMovie = async (movieId: number): Promise<{ name: string; content: Content[] } | null> => {
  if (!TMDB_API_KEY) return null;
  
  try {
    // First get the movie details to find its collection
    const movieResponse = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`
    );
    const movieData = await movieResponse.json();
    
    if (!movieData.belongs_to_collection) return null;
    
    return await getCollection(movieData.belongs_to_collection.id);
  } catch (error) {
    console.error('Error finding collection by movie:', error);
    return null;
  }
};

// Get trending today (real-time trending)
export const getTrendingToday = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];
  
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();
    
    return (data.results || [])
      .filter((item: any) => item.poster_path)
      .map((item: any) => {
        const type = item.media_type === 'tv' ? 'tv' : 'movie';
        return convertTMDBToContent(item, type);
      })
      .slice(0, 40);
  } catch (error) {
    console.error('Error fetching trending today:', error);
    return [];
  }
};

// Get recently added content (released in the last 30 days)
export const getRecentlyAdded = async (): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    // Calculate date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);

    // Fetch recently released movies and TV shows
    const [moviesRes, tvRes] = await Promise.all([
      fetch(
        `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&primary_release_date.gte=${thirtyDaysAgoStr}&primary_release_date.lte=${todayStr}&sort_by=popularity.desc&page=1`
      ),
      fetch(
        `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&first_air_date.gte=${thirtyDaysAgoStr}&first_air_date.lte=${todayStr}&sort_by=popularity.desc&page=1`
      ),
    ]);

    const moviesData = await moviesRes.json();
    const tvData = await tvRes.json();

    const movies = (moviesData.results || [])
      .filter((m: TMDBMovie) => m.poster_path)
      .slice(0, 20)
      .map((m: TMDBMovie) => convertTMDBToContent(m, 'movie'));

    const tv = (tvData.results || [])
      .filter((s: TMDBShow) => s.poster_path)
      .slice(0, 20)
      .map((s: TMDBShow) => convertTMDBToContent(s, 'tv'));

    // Combine and sort by release date (newest first)
    const allContent: Array<Content & { releaseDate: string }> = [
      ...movies.map((m: Content) => ({
        ...m,
        releaseDate: (moviesData.results.find((r: any) => r.id === m.id) as any)?.release_date || '',
      })),
      ...tv.map((t: Content) => ({
        ...t,
        releaseDate: (tvData.results.find((r: any) => r.id === t.id) as any)?.first_air_date || '',
      })),
    ];

    return allContent
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
      .slice(0, 40)
      .map(({ releaseDate, ...content }) => content);
  } catch (error) {
    console.error('Error fetching recently added:', error);
    return [];
  }
};

// Episode details interface
export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number;
}

// TV Show Details interface
export interface TMDBTVDetails {
  id: number;
  name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: Array<{
    id: number;
    season_number: number;
    episode_count: number;
    name: string;
    overview: string;
    poster_path: string | null;
  }>;
}

// Get TV show details (including number of seasons)
export const getTVShowDetails = async (tvId: number): Promise<TMDBTVDetails | null> => {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    if (data.id) {
      return {
        id: data.id,
        name: data.name,
        number_of_seasons: data.number_of_seasons || 0,
        number_of_episodes: data.number_of_episodes || 0,
        seasons: (data.seasons || []).map((s: any) => ({
          id: s.id,
          season_number: s.season_number,
          episode_count: s.episode_count || 0,
          name: s.name || `Season ${s.season_number}`,
          overview: s.overview || '',
          poster_path: s.poster_path,
        })),
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching TV show details for ${tvId}:`, error);
    return null;
  }
};

// Get season episodes
export const getSeasonEpisodes = async (tvId: number, seasonNumber: number): Promise<TMDBEpisode[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    return (data.episodes || []).map((ep: any) => ({
      id: ep.id,
      name: ep.name,
      overview: ep.overview || '',
      still_path: ep.still_path,
      episode_number: ep.episode_number,
      season_number: ep.season_number,
      air_date: ep.air_date || '',
      runtime: ep.runtime || 0,
    }));
  } catch (error) {
    console.error(`Error fetching season ${seasonNumber} episodes for TV ${tvId}:`, error);
    return [];
  }
};

// TMDB Video interface
export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

// Get trailers/videos for a movie or TV show
export const getTrailer = async (type: 'movie' | 'tv', id: number): Promise<string | null> => {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();

    const videos: TMDBVideo[] = data.results || [];
    
    // Prefer official trailers, then any trailer, then teasers
    const trailer = videos.find(v => 
      v.site === 'YouTube' && 
      v.type === 'Trailer' && 
      v.official
    ) || videos.find(v => 
      v.site === 'YouTube' && 
      v.type === 'Trailer'
    ) || videos.find(v => 
      v.site === 'YouTube' && 
      v.type === 'Teaser'
    );

    if (trailer && trailer.key) {
      // Use youtube-nocookie domain for better privacy and age-restricted video support
      // Enable sound by default (remove mute), but allow user to control
      return `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching trailer for ${type} ${id}:`, error);
    return null;
  }
};

// --- Cast & Recommendations ---
export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export const getCredits = async (type: 'movie' | 'tv', id: number): Promise<TMDBCast[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`
    );
    const data = await response.json();
    return (data.cast || []) as TMDBCast[];
  } catch (error) {
    console.error('Error fetching credits:', error);
    return [];
  }
};

export const getRecommendations = async (type: 'movie' | 'tv', id: number): Promise<Content[]> => {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}&page=1`
    );
    const data = await response.json();
    const results = (data.results || []).slice(0, 40);
    return results
      .filter((item: TMDBMovie | TMDBShow) => (item as any).poster_path)
      .map((item: TMDBMovie | TMDBShow) => convertTMDBToContent(item, type));
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return [];
  }
};
