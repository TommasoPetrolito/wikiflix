import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Stream, StreamCategory } from '@/types';
import { getStreams, formatStreamTime, isStreamLive, isStreamUpcoming } from '@/utils/streams';
import { StreamCard } from '@/components/StreamCard';
import { SectionSkeleton } from '@/components/SectionSkeleton';
import { Navbar } from '@/components/Navbar';
import { Category } from '@/types';
import { lookupTableByLeagueName, getHeadToHead, extractTeamsFromTitle, isSportsDBConfigured, SportsDBTableRow, HeadToHeadMatch, calculateHeadToHeadStats, HeadToHeadStats } from '@/utils/sportsdb';
import { isChannelStream } from '@/utils/streams';
import './SportsPage.css';

export default function SportsPage() {
  const [streamsData, setStreamsData] = useState<StreamCategory[]>([]);
  const [liveStreams, setLiveStreams] = useState<Stream[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<Stream[]>([]);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCategory, setCurrentCategory] = useState<Category>('sports');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [isPlayerLoading, setIsPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // SportsDB contextual data
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [leagueTable, setLeagueTable] = useState<SportsDBTableRow[] | null>(null);
  const [headToHead, setHeadToHead] = useState<HeadToHeadMatch[]>([]);
  const [h2hStats, setH2hStats] = useState<HeadToHeadStats | null>(null);
  const [teamNames, setTeamNames] = useState<{ teamA: string | null; teamB: string | null }>({ teamA: null, teamB: null });
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Filter sports categories - memoized for performance
  const isSportsCategory = useCallback((categoryName: string): boolean => {
    if (!categoryName || typeof categoryName !== 'string') return false;
    
    const lower = categoryName.toLowerCase();
    
    // Early exit for common exclusions
    if (lower.includes('24/7') || 
        lower.includes('cows') || 
        lower.includes('south park') ||
        lower.includes('family guy') ||
        lower.includes('simpsons') ||
        lower.includes('test')) {
      return false;
    }
    
    // Check sports keywords
    const sportsKeywords = ['basketball', 'football', 'soccer', 'baseball', 'hockey', 'tennis',
      'combat', 'mma', 'boxing', 'wrestling', 'ufc', 'racing', 'formula', 'nascar',
      'golf', 'rugby', 'cricket', 'volleyball', 'sports'];
    
    return sportsKeywords.some(keyword => lower.includes(keyword));
  }, []);

  useEffect(() => {
    const loadStreams = async () => {
      // Don't refresh streams if user is watching in fullscreen
      if (isFullscreen && selectedStream) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      try {
        const response = await getStreams();
        
        // Validate response
        if (!response || !response.streams || !Array.isArray(response.streams)) {
          throw new Error('Invalid API response structure');
        }
        
        // Filter to only sports categories
        const sportsCategories = response.streams.filter(cat => 
          cat && cat.category && isSportsCategory(cat.category)
        );
        
        // Process all streams in one pass for better performance
        const now = Math.floor(Date.now() / 1000);
        const allLiveStreams: Stream[] = [];
        const allUpcomingStreams: Stream[] = [];
        
        // Filter streams within each category and extract live/upcoming in one pass
        // Pre-compute excluded name patterns for faster filtering
        const excludedPatterns = ['24/7', 'cows', 'test'];
        
        const filteredCategories = sportsCategories.map(cat => {
          const validStreams = (cat.streams || []).filter(stream => {
            // Basic validation - early exit for invalid streams
            if (!stream || typeof stream !== 'object') return false;
            if (!stream.name || typeof stream.name !== 'string') return false;
            if (!stream.category_name || typeof stream.category_name !== 'string') return false;
            
            // Quick exclusion check
            const nameLower = stream.name.toLowerCase();
            for (const pattern of excludedPatterns) {
              if (nameLower.includes(pattern)) return false;
            }
            
            // Exclude channel/network streams (like RedZone) - only show actual matchups
            if (isChannelStream(stream.name)) return false;
            
            // Category check
            if (!isSportsCategory(stream.category_name)) return false;
            
            // Iframe validation
            if (!stream.iframe || typeof stream.iframe !== 'string' || !stream.iframe.trim()) {
              return false;
            }
            
            // Extract live and upcoming streams during filtering
            const isLive = stream.always_live === 1 || 
                          (stream.starts_at && stream.ends_at && 
                           stream.starts_at <= now && stream.ends_at >= now);
            const isUpcoming = stream.starts_at && 
                               stream.starts_at > now && 
                               stream.starts_at <= now + 86400;
            
            if (isLive) allLiveStreams.push(stream);
            if (isUpcoming) allUpcomingStreams.push(stream);
            
            return true;
          });
          
          return { ...cat, streams: validStreams };
        }).filter(cat => cat.streams && cat.streams.length > 0);
        
        setStreamsData(filteredCategories);
        
        // Sort upcoming streams by start time
        allUpcomingStreams.sort((a, b) => (a.starts_at || 0) - (b.starts_at || 0));
        setLiveStreams(allLiveStreams);
        setUpcomingStreams(allUpcomingStreams);
      } catch (err: any) {
        console.error('Error loading streams:', err);
        
        // Check if API is not configured
        if (err?.message === 'API_URL_NOT_CONFIGURED' || 
            err?.message?.includes('CORS') ||
            err?.message?.includes('Failed to fetch')) {
          setError('API_URL_NOT_CONFIGURED');
        } else {
          setError('Failed to load sports streams. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadStreams();
    
    // Refresh every 90 seconds (1.5 minutes) to align with cache duration
    // Only refresh if API is configured and not in fullscreen
    const interval = setInterval(() => {
      if ((!error || error !== 'API_URL_NOT_CONFIGURED') && !isFullscreen && !selectedStream) {
        loadStreams();
      }
    }, 90000); // 90 seconds instead of 60 to reduce load
    
    return () => clearInterval(interval);
  }, [error, isFullscreen, selectedStream, isSportsCategory]);

  // Auto-advance hero slider
  useEffect(() => {
    const total = Math.min(liveStreams.length + upcomingStreams.length, 5);
    if (total <= 1) return;

    const sliderInterval = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % total);
    }, 5000);

    return () => clearInterval(sliderInterval);
  }, [liveStreams.length, upcomingStreams.length]);

  // Update countdown timer every minute
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 60000); // Update every minute

    return () => clearInterval(timerInterval);
  }, []);

  const handleStreamClick = (stream: Stream) => {
    // Don't allow changing streams while in fullscreen
    if (isFullscreen) {
      return;
    }
    
    if (!stream.iframe) {
      alert('Stream is not available yet. Please check back later.');
      return;
    }
    setSelectedStream(stream);
    setIsPlayerLoading(true);
    setPlayerError(null);
  };

  const handleClosePlayer = () => {
    // Don't close when in fullscreen
    if (isFullscreen) {
      return;
    }
    
    setSelectedStream(null);
    setIsPlayerLoading(false);
    setPlayerError(null);
    setIsFullscreen(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Don't close if in fullscreen or if clicking on child elements
    if (isFullscreen || e.target !== e.currentTarget) {
      return;
    }
    handleClosePlayer();
  };

  // Handle ESC key to close player (but not when in fullscreen)
  useEffect(() => {
    if (!selectedStream) {
      document.body.style.overflow = 'auto';
      return;
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close player if not in fullscreen
        // If in fullscreen, let the browser handle ESC to exit fullscreen
        if (!isFullscreen) {
          handleClosePlayer();
        }
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [selectedStream, isFullscreen]);

  // Listen for fullscreen changes to prevent unwanted closes
  useEffect(() => {
    if (!selectedStream) {
      setIsFullscreen(false);
      return;
    }

    const handleFullscreenChange = () => {
      const fullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(fullscreen);
    };

    // Check initial state
    handleFullscreenChange();

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [selectedStream]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsPlayerLoading(false);
    setPlayerError(null);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsPlayerLoading(false);
    setPlayerError('Failed to load stream. Please try again or check your connection.');
  };

  // Prevent window focus/blur from interfering with playback
  useEffect(() => {
    if (!selectedStream) return;

    const handleBlur = (e: FocusEvent) => {
      // Don't let window blur interfere with fullscreen playback
      if (isFullscreen) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleVisibilityChange = () => {
      // Prevent visibility changes from affecting playback in fullscreen
      if (isFullscreen && document.hidden) {
        // Keep the player active even if tab is hidden
        return;
      }
    };

    window.addEventListener('blur', handleBlur, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedStream, isFullscreen]);

  // Protect selectedStream from being cleared while in fullscreen
  useEffect(() => {
    if (isFullscreen && !selectedStream) {
      // If we somehow lost the stream while in fullscreen, exit fullscreen
      const exitFullscreen = () => {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      };
      exitFullscreen();
    }
  }, [isFullscreen, selectedStream]);

  // Prevent iframe message events from interfering
  useEffect(() => {
    if (!selectedStream) return;

    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from the iframe origin
      if (!selectedStream?.iframe) return;
      
      try {
        const iframeUrl = new URL(selectedStream.iframe);
        if (event.origin !== iframeUrl.origin && !event.origin.includes(iframeUrl.hostname)) {
          return;
        }

        // Prevent any pause/stop messages from closing the player
        if (event.data?.type === 'pause' || 
            event.data?.action === 'pause' ||
            event.data?.command === 'pause' ||
            (typeof event.data === 'string' && event.data.toLowerCase().includes('pause'))) {
          // Ignore pause messages - don't let them affect playback
          return;
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [selectedStream]);

  // Fetch contextual stats (league table + H2H) for selected stream via TheSportsDB
  useEffect(() => {
    const run = async () => {
      setLeagueTable(null);
      setHeadToHead([]);
      setH2hStats(null);
      setTeamNames({ teamA: null, teamB: null });
      setLeagueName(null);
      setStatsError(null);
      if (!selectedStream) return;
      if (!isSportsDBConfigured()) return;

      // Detect sport eligibility
      const sport = selectedStream.category_name.toLowerCase();
      const isBallSport = sport.includes('football') || sport.includes('soccer') || sport.includes('basketball') || sport.includes('nba');
      if (!isBallSport) return;

      setStatsLoading(true);
      try {
        // Determine league name (prefer tag, otherwise infer from title)
        let detectedLeague: string | null = null;
        const tag = (selectedStream.tag || '').toLowerCase();
        const nameLower = selectedStream.name.toLowerCase();
        if (tag.includes('premier league')) detectedLeague = 'Premier League';
        else if (tag.includes('bundesliga')) detectedLeague = 'Bundesliga';
        else if (tag.includes('la liga')) detectedLeague = 'La Liga';
        else if (tag.includes('serie a')) detectedLeague = 'Serie A';
        else if (tag.includes('ligue 1')) detectedLeague = 'Ligue 1';
        else if (tag.includes('nba') || sport.includes('nba') || sport.includes('basketball')) detectedLeague = 'NBA';
        else if (nameLower.includes('premier league')) detectedLeague = 'Premier League';
        else if (nameLower.includes('bundesliga')) detectedLeague = 'Bundesliga';
        else if (nameLower.includes('la liga')) detectedLeague = 'La Liga';
        else if (nameLower.includes('serie a')) detectedLeague = 'Serie A';
        else if (nameLower.includes('ligue 1')) detectedLeague = 'Ligue 1';

        if (detectedLeague) {
          setLeagueName(detectedLeague);
          const table = await lookupTableByLeagueName(detectedLeague);
          console.log(`[SportsDB] League table fetched: ${table?.length || 0} teams for ${detectedLeague}`);
          if (table && table.length > 0) {
            setLeagueTable(table);
            console.log(`[SportsDB] Set league table with ${table.length} teams`);
          }
        }

        const { teamA, teamB } = extractTeamsFromTitle(selectedStream.name);
        console.log(`[SportsDB] Extracted teams from "${selectedStream.name}":`, { teamA, teamB });
        if (teamA && teamB) {
          setTeamNames({ teamA, teamB });
          try {
            const h2h = await getHeadToHead(teamA, teamB);
            console.log(`[SportsDB] Head-to-head fetched: ${h2h.length} matches`);
            setHeadToHead(h2h);
            if (h2h.length > 0) {
              const stats = calculateHeadToHeadStats(h2h, teamA, teamB);
              console.log(`[SportsDB] Calculated stats:`, stats);
              setH2hStats(stats);
            } else {
              console.log(`[SportsDB] No head-to-head matches found`);
              setH2hStats(null);
            }
          } catch (h2hError) {
            console.error(`[SportsDB] Error fetching head-to-head:`, h2hError);
            setHeadToHead([]);
            setH2hStats(null);
          }
        } else {
          console.log(`[SportsDB] Could not extract team names from title`);
          setTeamNames({ teamA: null, teamB: null });
          setH2hStats(null);
        }
      } catch (e: any) {
        setStatsError('Failed to load match context.');
      } finally {
        setStatsLoading(false);
      }
    };
    run();
  }, [selectedStream]);

  const handleCategoryChange = (category: Category) => {
    setCurrentCategory(category);
    if (category === 'all') {
      window.location.href = '/';
    } else if (category === 'movies') {
      window.location.href = '/?category=movies';
    } else if (category === 'tv') {
      window.location.href = '/?category=tv';
    }
  };

  const handleSearchSubmit = (query: string) => {
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  };

  // Get sport type for CSS positioning - memoized for performance
  const getSportType = useCallback((stream: Stream): string => {
    if (!stream || !stream.category_name || !stream.name) return 'default';
    
    const category = stream.category_name.toLowerCase();
    const matchName = stream.name.toLowerCase();
    
    // Early exit checks - most common sports first
    if (category.includes('basketball') || matchName.includes('nba') || 
        matchName.includes('hawks') || matchName.includes('pacers') || 
        matchName.includes('celtics') || matchName.includes('lakers') ||
        matchName.includes('warriors') || matchName.includes('nets') ||
        matchName.includes('raptors') || matchName.includes('cavaliers') ||
        matchName.includes('basketball')) {
      return 'basketball';
    }
    if (category.includes('soccer') || matchName.includes('premier league') ||
        matchName.includes('bundesliga') || matchName.includes('la liga') ||
        matchName.includes('champions league') || matchName.includes('augsburg') ||
        matchName.includes('dortmund') || matchName.includes('girona') ||
        (category.includes('football') && !matchName.includes('nfl'))) {
      return 'soccer';
    }
    if (matchName.includes('nfl') || matchName.includes('super bowl') ||
        category.includes('american football')) {
      return 'football';
    }
    if (category.includes('baseball') || matchName.includes('mlb') || matchName.includes('baseball')) {
      return 'baseball';
    }
    if (category.includes('hockey') || matchName.includes('nhl') || matchName.includes('hockey')) {
      return 'hockey';
    }
    if (category.includes('tennis') || matchName.includes('tennis')) {
      return 'tennis';
    }
    if (category.includes('combat') || matchName.includes('mma') || matchName.includes('ufc')) {
      return 'combat';
    }
    if (category.includes('boxing') || matchName.includes('boxing')) {
      return 'boxing';
    }
    if (matchName.includes('f1') || matchName.includes('nascar') ||
        matchName.includes('racing') || category.includes('racing')) {
      return 'racing';
    }
    if (category.includes('golf') || matchName.includes('golf')) {
      return 'golf';
    }
    
    return 'default';
  }, []);

  // Format countdown time for upcoming matches
  const getCountdown = (startsAt: number): string => {
    const diff = startsAt - currentTime;
    
    if (diff <= 0) return 'Starting soon';
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    } else {
      return `in ${minutes}m`;
    }
  };

  // Handle image load errors
  const handleImageError = (imageUrl: string) => {
    setFailedImages(prev => new Set(prev).add(imageUrl));
  };

  // Get dynamic hero image - always use action shots or player photos specific to the sport
  const getHeroImage = useCallback((stream: Stream): string => {
    // Extract sport type from category or match name
    const category = stream.category_name?.toLowerCase() || '';
    const matchName = stream.name?.toLowerCase() || '';
    
    // Expanded sport-specific image collections with diverse action photos
    // Using reliable Unsplash Source API with specific photo IDs for better reliability
    const sportImages: { [key: string]: string[] } = {
      'soccer': [
        'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&auto=format&q=80',
      ],
      'basketball': [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1519869325934-21d5c8e0e5d1?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1519766304817-4f37bda1a241?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1920&h=1080&fit=crop&auto=format&q=80',
      ],
      'football': [
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // American football field
        'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=1920&h=1080&fit=crop&q=80', // Football players
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop&q=80', // Football action
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&q=80', // Football stadium
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&q=80', // Football game
      ],
      'baseball': [
        'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1920&h=1080&fit=crop&q=80', // Baseball field
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&h=1080&fit=crop&q=80', // Baseball players
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&q=80', // Baseball action
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&q=80', // Baseball stadium
      ],
      'hockey': [
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&q=80', // Hockey action
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&q=80', // Hockey players
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // Hockey rink
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&q=80', // Hockey game
      ],
      'tennis': [
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&h=1080&fit=crop&q=80', // Tennis court
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&q=80', // Tennis match
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&q=80', // Tennis players
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // Tennis action
      ],
      'combat': [
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // MMA/Combat
        'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=1920&h=1080&fit=crop&q=80', // Boxing ring
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&q=80', // Fight action
      ],
      'boxing': [
        'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=1920&h=1080&fit=crop&q=80', // Boxing ring
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // Boxing match
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&q=80', // Boxing action
      ],
      'racing': [
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&q=80', // Racing
        'https://images.unsplash.com/photo-1551963831-b3b1ca40c98e?w=1920&h=1080&fit=crop&q=80', // Race cars
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&h=1080&fit=crop&q=80', // Racing track
      ],
      'golf': [
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&h=1080&fit=crop&q=80', // Golf course
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&q=80', // Golf players
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&q=80', // Golf action
      ],
      'default': [
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&h=1080&fit=crop&auto=format&q=80',
        'https://images.unsplash.com/photo-1579952363873-27f3b1db2c31?w=1920&h=1080&fit=crop&auto=format&q=80',
      ],
    };
    
    // Detect sport type - check match name first (more specific)
    let imageSet = sportImages['default'];
    
    // Check for basketball first (most specific keywords)
    if (matchName.includes('basketball') || matchName.includes('nba') || 
        matchName.includes('hawks') || matchName.includes('pacers') || 
        matchName.includes('celtics') || matchName.includes('lakers') ||
        matchName.includes('warriors') || matchName.includes('nets') ||
        category.includes('basketball')) {
      imageSet = sportImages['basketball'];
    }
    // Check for soccer/football
    else if (matchName.includes('bundesliga') || matchName.includes('premier league') || 
             matchName.includes('la liga') || matchName.includes('champions league') ||
             matchName.includes('augsburg') || matchName.includes('dortmund') ||
             matchName.includes('girona') || matchName.includes('vs') && category.includes('football') ||
             category.includes('soccer') || (category.includes('football') && !matchName.includes('nfl'))) {
      imageSet = sportImages['soccer'];
    }
    // Check for American football
    else if (matchName.includes('nfl') || matchName.includes('super bowl') ||
             category.includes('american football') || 
             (category.includes('football') && matchName.includes('nfl'))) {
      imageSet = sportImages['football'];
    }
    // Check for baseball
    else if (matchName.includes('baseball') || matchName.includes('mlb') ||
             category.includes('baseball')) {
      imageSet = sportImages['baseball'];
    }
    // Check for hockey
    else if (matchName.includes('hockey') || matchName.includes('nhl') ||
             category.includes('hockey')) {
      imageSet = sportImages['hockey'];
    }
    // Check for tennis
    else if (matchName.includes('tennis') || category.includes('tennis')) {
      imageSet = sportImages['tennis'];
    }
    
    // Use stream ID as seed for consistent image per match
    const seed = stream.id % imageSet.length;
    let selectedImage = imageSet[seed];
    
    // If this image failed before, try different ones from the set
    if (failedImages.has(selectedImage)) {
      // Try to find an image that hasn't failed
      for (let i = 0; i < imageSet.length; i++) {
        const candidateIndex = (seed + i + 1) % imageSet.length;
        const candidateImage = imageSet[candidateIndex];
        if (!failedImages.has(candidateImage)) {
          selectedImage = candidateImage;
          break;
        }
      }
    }
    
    return selectedImage;
  }, [failedImages]);

  // Memoize hero streams to prevent unnecessary recalculations
  // MUST be called before any early returns to follow Rules of Hooks
  const heroStreams = useMemo(() => {
    return [...liveStreams, ...upcomingStreams].slice(0, 5);
  }, [liveStreams, upcomingStreams]);

  if (isLoading) {
    return (
      <>
        <Navbar
          currentCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
        />
        <div className="sports-page">
          <SectionSkeleton />
        </div>
      </>
    );
  }

  if (error) {
    const isApiNotConfigured = error === 'API_URL_NOT_CONFIGURED';
    
    return (
      <>
        <Navbar
          currentCategory={currentCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
        />
        <div className="sports-page">
          <div className="sports-error">
          {isApiNotConfigured ? (
            <>
              <div className="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h2>API Configuration Required</h2>
              <p>To use sports streams, please configure the API URL in <code>src/utils/streams.ts</code></p>
              <div className="error-instructions">
                <p><strong>Steps to configure:</strong></p>
                <ol>
                  <li>Open <code>flux/src/utils/streams.ts</code></li>
                  <li>Update <code>STREAMS_API_URL</code> with your actual API endpoint</li>
                  <li>Or set <code>VITE_STREAMS_API_URL</code> environment variable</li>
                  <li>Restart the development server</li>
                </ol>
                <p className="error-note">
                  <strong>Note:</strong> The API must support CORS with <code>Access-Control-Allow-Origin: *</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <p>{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </>
          )}
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar
        currentCategory={currentCategory}
        onCategoryChange={handleCategoryChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />
      <div className="sports-page">
        {/* Hero Slider with Multiple Matches */}
        <div className="sports-hero-slider">
          {heroStreams.length === 0 ? (
            <div className="sports-hero-content">
              <h1 className="sports-hero-title">Sports</h1>
              <p className="sports-hero-subtitle">Live games, matches, and events</p>
            </div>
          ) : (
            <>
              {/* Hero Slider Container */}
              <div className="hero-slides-container">
                  {heroStreams.map((stream, index) => {
                    const sportType = getSportType(stream);
                    return (
                      <div
                        key={`${stream.id}-${heroSlideIndex}`}
                        className={`hero-slide ${index === heroSlideIndex ? 'active' : ''} sport-${sportType}`}
                        style={{
                          backgroundImage: `url(${getHeroImage(stream)})`,
                        }}
                        data-stream-id={stream.id}
                      >
                        {/* Hidden img to detect load errors and preload */}
                        <img
                          src={getHeroImage(stream)}
                          alt=""
                          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                          onError={(e) => {
                            const failedUrl = (e.target as HTMLImageElement).src;
                            handleImageError(failedUrl);
                            // Update background image with fallback (will trigger re-render)
                            const slide = e.currentTarget.closest('.hero-slide') as HTMLElement;
                            if (slide) {
                              const newImage = getHeroImage(stream);
                              if (newImage !== failedUrl) {
                                slide.style.backgroundImage = `url(${newImage})`;
                                // Update the img src to retry with fallback
                                (e.target as HTMLImageElement).src = newImage;
                              }
                            }
                          }}
                          onLoad={(e) => {
                            // Mark image as loaded successfully
                            const slide = e.currentTarget.closest('.hero-slide') as HTMLElement;
                            if (slide) {
                              slide.classList.add('image-loaded');
                            }
                          }}
                        />
                        <div className="sports-hero-gradient"></div>
                        {/* API Poster with Team Logos */}
                        {stream.poster && (
                          <div className="hero-poster-box">
                            <img 
                              src={stream.poster} 
                              alt={stream.name}
                              className="hero-poster-image"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="sports-hero-content-featured">
                          <div className="featured-badge">
                            {liveStreams.includes(stream) ? (
                              <span className="featured-live">
                                <span className="live-dot"></span>
                                LIVE NOW
                              </span>
                            ) : (
                              <span className="featured-upcoming">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="clock-icon-small">
                                  <circle cx="12" cy="12" r="10"/>
                                  <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                UPCOMING
                              </span>
                            )}
                          </div>
                          <h1 className="featured-title">{stream.name}</h1>
                          <div className="featured-meta">
                            <span className="featured-category">{stream.category_name}</span>
                            <span className="featured-separator">•</span>
                            <span className="featured-tag">{stream.tag}</span>
                            {!liveStreams.includes(stream) && (
                              <>
                                <span className="featured-separator">•</span>
                                <span className="featured-time">{formatStreamTime(stream.starts_at)}</span>
                                <span className="featured-countdown">{getCountdown(stream.starts_at)}</span>
                              </>
                            )}
                          </div>
                          <button 
                            className="featured-watch-btn"
                            onClick={() => handleStreamClick(stream)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="play-icon">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                            {liveStreams.includes(stream) ? 'Watch Now' : 'View Details'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation Arrows */}
                {heroStreams.length > 1 && (
                  <>
                    <button
                      className="hero-nav-btn hero-nav-prev"
                      onClick={() => setHeroSlideIndex((prev) => (prev === 0 ? heroStreams.length - 1 : prev - 1))}
                      aria-label="Previous slide"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    </button>
                    <button
                      className="hero-nav-btn hero-nav-next"
                      onClick={() => setHeroSlideIndex((prev) => (prev === heroStreams.length - 1 ? 0 : prev + 1))}
                      aria-label="Next slide"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </>
                )}

                {/* Slide Indicators */}
                {heroStreams.length > 1 && (
                  <div className="hero-slide-indicators">
                    {heroStreams.map((_, index) => (
                      <button
                        key={index}
                        className={`hero-indicator ${index === heroSlideIndex ? 'active' : ''}`}
                        onClick={() => setHeroSlideIndex(index)}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </>
          )}
        </div>

      <main className="sports-content">
        {/* Live Matches Section - Organized by Sport */}
        {liveStreams.length > 0 ? (() => {
          // Group live streams by sport category
          const liveByCategory: { [key: string]: Stream[] } = {};
          liveStreams.forEach(stream => {
            const cat = stream.category_name || 'Other';
            if (!liveByCategory[cat]) {
              liveByCategory[cat] = [];
            }
            liveByCategory[cat].push(stream);
          });

          return (
            <>
              <section className="sports-section live-matches-section">
                <div className="section-header-with-badge">
                  <h2 className="section-title">Live Matches</h2>
                  <div className="live-badge-large">
                    <span className="live-dot"></span>
                    <span>{liveStreams.length} Live</span>
                  </div>
                </div>
                
                {Object.entries(liveByCategory).map(([categoryName, streams]) => (
                  <div key={categoryName} className="live-category-group">
                    <h3 className="live-category-title">{categoryName}</h3>
                    <div className="streams-horizontal-scroll">
                      {streams.map(stream => (
                        <StreamCard
                          key={stream.id}
                          stream={stream}
                          onClick={handleStreamClick}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </>
          );
        })() : upcomingStreams.length > 0 && (
          <section className="sports-section upcoming-matches-section">
            <div className="section-header-with-badge">
              <h2 className="section-title">Coming Soon</h2>
              <div className="upcoming-badge-large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="clock-icon">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{upcomingStreams.length} Upcoming</span>
              </div>
            </div>
            <div className="upcoming-info">
              <p>No live matches right now. Check out what's starting soon:</p>
            </div>
            <div className="streams-horizontal-scroll">
              {upcomingStreams.map(stream => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  onClick={handleStreamClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Streams by Category */}
        <div className="all-streams-divider">
          <h2 className="section-title">All Sports</h2>
        </div>
        
        {streamsData.map(category => {
          if (category.streams.length === 0) return null;

          return (
            <section key={category.id} className="sports-section">
              <h2 className="section-title">{category.category}</h2>
              <div className="streams-horizontal-scroll">
                {category.streams.map(stream => (
                  <StreamCard
                    key={stream.id}
                    stream={stream}
                    onClick={handleStreamClick}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {/* Enhanced Player Modal */}
      {selectedStream && selectedStream.iframe && (
        <div className="stream-player-modal">
          <div className="stream-player-overlay" onClick={handleOverlayClick}></div>
          <div 
            className="stream-player-container"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="stream-player-close" 
              onClick={handleClosePlayer}
              aria-label="Close player"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Loading State */}
            {isPlayerLoading && (
              <div className="stream-player-loading">
                <div className="loading-spinner"></div>
                <p>Loading stream...</p>
              </div>
            )}

            {/* Error State */}
            {playerError && (
              <div className="stream-player-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3>Stream Error</h3>
                <p>{playerError}</p>
                <button onClick={handleClosePlayer} className="error-close-btn">
                  Close
                </button>
              </div>
            )}

            {/* Stream Info Header */}
            <div className="stream-player-header">
              <div className="stream-header-content">
                <div className="stream-header-main">
                  {isStreamLive(selectedStream) && (
                    <div className="stream-live-badge-header">
                      <span className="live-dot"></span>
                      <span>LIVE</span>
                    </div>
                  )}
                  {isStreamUpcoming(selectedStream) && (
                    <div className="stream-upcoming-badge-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>UPCOMING</span>
                    </div>
                  )}
                  <h2 className="stream-player-title">{selectedStream.name}</h2>
                </div>
                <div className="stream-header-meta">
                  <span className="stream-meta-item">{selectedStream.category_name}</span>
                  <span className="stream-meta-separator">•</span>
                  <span className="stream-meta-item">{selectedStream.tag}</span>
                  {isStreamUpcoming(selectedStream) && (
                    <>
                      <span className="stream-meta-separator">•</span>
                      <span className="stream-meta-item">{formatStreamTime(selectedStream.starts_at)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Iframe Player */}
            <div 
              className="stream-iframe-wrapper"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <iframe
                ref={iframeRef}
                key={selectedStream.id}
                src={selectedStream.iframe}
                className="stream-player-iframe"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; microphone; camera; display-capture; clipboard-read; clipboard-write"
                referrerPolicy="no-referrer-when-downgrade"
                title={selectedStream.name}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                scrolling="no"
                style={{ border: 'none' }}
                tabIndex={-1}
              />
            </div>

            {/* Stream Description Section */}
            <div className="stream-player-description">
              <div className="stream-description-content">
                <h3 className="stream-description-title">{selectedStream.name}</h3>
                
                <div className="stream-description-meta">
                  <div className="stream-description-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span>{selectedStream.category_name}</span>
                  </div>
                  <div className="stream-description-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>{selectedStream.tag}</span>
                  </div>
                  {isStreamLive(selectedStream) && (
                    <div className="stream-description-meta-item">
                      <span className="live-dot"></span>
                      <span>Live Now</span>
                    </div>
                  )}
                  {isStreamUpcoming(selectedStream) && (
                    <div className="stream-description-meta-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>Starts {formatStreamTime(selectedStream.starts_at)}</span>
                    </div>
                  )}
                </div>

                <p className="stream-description-text">
                  {isStreamLive(selectedStream) 
                    ? `Watch ${selectedStream.name} live now. ${selectedStream.category_name} action is underway. Don't miss out on the exciting moments as they happen.`
                    : isStreamUpcoming(selectedStream)
                    ? `${selectedStream.name} is scheduled to start ${formatStreamTime(selectedStream.starts_at)}. Tune in to catch all the ${selectedStream.category_name} action live.`
                    : `Enjoy watching ${selectedStream.name}. This ${selectedStream.category_name} stream is available for viewing.`}
                </p>

                {/* Stream Stats */}
                <div className="stream-stats-grid">
                  <div className="stream-stat-card">
                    <div className="stream-stat-label">Status</div>
                    <div className="stream-stat-value">
                      {isStreamLive(selectedStream) ? (
                        <span className="status-badge status-live">
                          <span className="status-dot"></span>
                          Live
                        </span>
                      ) : isStreamUpcoming(selectedStream) ? (
                        <span className="status-badge status-upcoming">Upcoming</span>
                      ) : (
                        <span className="status-badge status-available">Available</span>
                      )}
                    </div>
                  </div>
                  <div className="stream-stat-card">
                    <div className="stream-stat-label">Category</div>
                    <div className="stream-stat-value">{selectedStream.category_name}</div>
                  </div>
                  <div className="stream-stat-card">
                    <div className="stream-stat-label">Provider</div>
                    <div className="stream-stat-value">{selectedStream.tag || 'Stream'}</div>
                  </div>
                  {isStreamUpcoming(selectedStream) && (
                    <div className="stream-stat-card">
                      <div className="stream-stat-label">Start Time</div>
                      <div className="stream-stat-value">{formatStreamTime(selectedStream.starts_at)}</div>
                    </div>
                  )}
                </div>

                {/* League Standings/Table (SportsDB when available) */}
                {leagueTable && leagueTable.length > 0 && (
                  <div className="league-standings">
                    <h4 className="standings-title">
                      {leagueName ? `${leagueName} Standings` : 'League Standings'}
                      <span style={{ fontSize: '0.9rem', fontWeight: 'normal', marginLeft: '1rem', color: 'rgba(255,255,255,0.6)' }}>
                        ({leagueTable.length} teams shown)
                        {leagueTable.length < 10 && (
                          <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: 'rgba(255,255,255,0.4)' }}>
                            (API may limit results)
                          </span>
                        )}
                      </span>
                    </h4>
                    
                    <div className="standings-table-wrapper">
                      <table className="standings-table">
                        <thead>
                          <tr>
                            <th className="standings-pos">#</th>
                            <th className="standings-team">Team</th>
                            <th className="standings-stat">P</th>
                            <th className="standings-stat">W</th>
                            <th className="standings-stat">D</th>
                            <th className="standings-stat">L</th>
                            <th className="standings-stat">GD</th>
                            <th className="standings-stat">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leagueTable.map((row, idx) => {
                            // Check if this team is playing in the current match
                            const teamName = row.name.toLowerCase();
                            const matchTitle = selectedStream.name.toLowerCase();
                            const isPlayingTeam = matchTitle.includes(teamName) || 
                                                  teamName.split(' ').some(word => word.length > 3 && matchTitle.includes(word));
                            
                            return (
                            <tr key={row.idTeam} className={`standings-row ${isPlayingTeam ? 'playing-team' : ''}`}>
                              <td className="standings-pos">{idx + 1}</td>
                              <td className="standings-team">
                                <div className="team-cell">
                                  {row.badge && (
                                    <img 
                                      src={row.badge} 
                                      alt={row.name}
                                      className="team-badge"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <span className="team-name">{row.name}</span>
                                </div>
                              </td>
                              <td className="standings-stat">{row.played ?? '-'}</td>
                              <td className="standings-stat">{row.win ?? '-'}</td>
                              <td className="standings-stat">{row.draw ?? '-'}</td>
                              <td className="standings-stat">{row.loss ?? '-'}</td>
                              <td className="standings-stat standings-gd">
                                {row.goalsdifference != null ? (
                                  <span className={row.goalsdifference > 0 ? 'gd-positive' : row.goalsdifference < 0 ? 'gd-negative' : ''}>
                                    {row.goalsdifference > 0 ? '+' : ''}{row.goalsdifference}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="standings-stat standings-points">{(row.total as any) ?? '-'}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {statsError && <p className="standings-note">{statsError}</p>}
                  </div>
                )}

                {/* Debug Info (temporary) */}
                {selectedStream && (
                  <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <strong>Debug Info:</strong><br/>
                    Head-to-Head matches: {headToHead?.length || 0}<br/>
                    H2H Stats: {h2hStats ? 'Loaded' : 'Not loaded'}<br/>
                    Team A: {teamNames.teamA || 'Not extracted'}<br/>
                    Team B: {teamNames.teamB || 'Not extracted'}<br/>
                    Stats Loading: {statsLoading ? 'Yes' : 'No'}<br/>
                    Stats Error: {statsError || 'None'}
                  </div>
                )}

                {/* Head-to-Head Stats and Matches */}
                {headToHead && headToHead.length > 0 && h2hStats && teamNames.teamA && teamNames.teamB && (
                  <div className="h2h-section">
                    <h4 className="h2h-title">Head-to-Head History</h4>
                    
                    {/* Stats Summary */}
                    <div className="h2h-stats-summary">
                      <div className="h2h-stat-card">
                        <div className="h2h-stat-label">Total Matches</div>
                        <div className="h2h-stat-value">{h2hStats.totalMatches}</div>
                      </div>
                      <div className="h2h-stat-card h2h-stat-wins">
                        <div className="h2h-stat-label">{teamNames.teamA} Wins</div>
                        <div className="h2h-stat-value">{h2hStats.teamAWins}</div>
                      </div>
                      <div className="h2h-stat-card h2h-stat-draws">
                        <div className="h2h-stat-label">Draws</div>
                        <div className="h2h-stat-value">{h2hStats.draws}</div>
                      </div>
                      <div className="h2h-stat-card h2h-stat-wins">
                        <div className="h2h-stat-label">{teamNames.teamB} Wins</div>
                        <div className="h2h-stat-value">{h2hStats.teamBWins}</div>
                      </div>
                      <div className="h2h-stat-card">
                        <div className="h2h-stat-label">Goals ({teamNames.teamA})</div>
                        <div className="h2h-stat-value">{h2hStats.teamAGoals}</div>
                      </div>
                      <div className="h2h-stat-card">
                        <div className="h2h-stat-label">Goals ({teamNames.teamB})</div>
                        <div className="h2h-stat-value">{h2hStats.teamBGoals}</div>
                      </div>
                    </div>

                    {/* Recent Form */}
                    {h2hStats.recentForm.length > 0 && (
                      <div className="h2h-form">
                        <div className="h2h-form-label">Recent Form ({teamNames.teamA}):</div>
                        <div className="h2h-form-badges">
                          {h2hStats.recentForm.map((result, idx) => (
                            <span 
                              key={idx} 
                              className={`h2h-form-badge ${result === 'W' ? 'form-win' : result === 'L' ? 'form-loss' : 'form-draw'}`}
                            >
                              {result}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Match History */}
                    <div className="h2h-matches-header">
                      <h5 className="h2h-matches-title">Previous Matches ({Math.min(headToHead.length, 10)} shown)</h5>
                    </div>
                    <ul className="h2h-list">
                      {headToHead.slice(0, 10).map(match => (
                        <li key={match.idEvent} className="h2h-item">
                          <span className="h2h-date">{match.date ? new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                          <span className="h2h-teams">{match.homeTeam} vs {match.awayTeam}</span>
                          <span className="h2h-score">
                            {match.homeScore !== null && match.awayScore !== null 
                              ? `${match.homeScore} - ${match.awayScore}`
                              : 'TBD'}
                          </span>
                          {match.venue && <span className="h2h-venue">{match.venue}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Footer */}
            <div className="stream-player-footer">
              <div className="stream-footer-content">
                <p className="stream-footer-text">
                  {isStreamLive(selectedStream) 
                    ? 'Live stream in progress' 
                    : isStreamUpcoming(selectedStream)
                    ? `Stream starts ${formatStreamTime(selectedStream.starts_at)}`
                    : 'Stream available'}
                </p>
                <div className="stream-footer-hint">
                  Press <kbd>ESC</kbd> to close
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

