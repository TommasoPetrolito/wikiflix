import { useState, useMemo, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ContentGrid } from './components/ContentGrid';
import { ContentSquareGrid } from './components/ContentSquareGrid';
import { PlayerModal } from './components/PlayerModal';
import { InfoModal } from './components/InfoModal';
import { SectionSkeleton } from './components/SectionSkeleton';
import { Content, Category } from './types';
import { addToContinueWatching, getContinueWatching, migrateKnownFixes, getMyList } from './utils/storage';
import { usePlayerTracking } from './hooks/usePlayerTracking';
import { useTVNavigation } from './hooks/useTVNavigation';
import { searchTMDB, getTrendingMovies, getTopRatedMovies, getTop10, getByGenre, getTrendingTV, getRecommendations, getUpcomingMovies, getCriticallyAcclaimed, getHiddenGems, getTrendingToday, getMoviesByActor, findCollectionByMovie, getRecentlyAdded, getForYouContent, getRegionalContent, getFemaleDirectedContent, getLGBTContent, getScienceFictionContent, getRomanticComedyContent, getRandomHero } from './utils/wikidataAdapter';
import { MoodSelector } from './components/MoodSelector';
import './App.css';

const FALLBACK_CONTENT: Content | null = null;

function App() {
  const [currentCategory, setCurrentCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [infoContent, setInfoContent] = useState<Content | null>(null);
  const [continueWatching, setContinueWatching] = useState<Content[]>(getContinueWatching());
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [heroContent, setHeroContent] = useState<Content[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Content[]>([]);
  const [isLoadingHero, setIsLoadingHero] = useState(false);
  const [rowAction, setRowAction] = useState<Content[]>([]);
  const [rowComedy, setRowComedy] = useState<Content[]>([]);
  const [rowDarkMoody, setRowDarkMoody] = useState<Content[]>([]);
  const [rowFamily, setRowFamily] = useState<Content[]>([]);
  const [rowScienceFiction, setRowScienceFiction] = useState<Content[]>([]);
  const [rowRomanticComedy, setRowRomanticComedy] = useState<Content[]>([]);
  const [rowBecause, setRowBecause] = useState<{title:string; items: Content[]}>({title:'', items: []});
  const [rowMyList, setRowMyList] = useState<Content[]>(getMyList());
  const [rowComingSoon, setRowComingSoon] = useState<Content[]>([]);
  const [rowCriticallyAcclaimed, setRowCriticallyAcclaimed] = useState<Content[]>([]);
  const [rowHiddenGems, setRowHiddenGems] = useState<Content[]>([]);
  const [rowTrendingToday, setRowTrendingToday] = useState<Content[]>([]);
  const [rowFemaleDirectors, setRowFemaleDirectors] = useState<Content[]>([]);
  const [rowLGBT, setRowLGBT] = useState<Content[]>([]);
  const [rowSpanish, setRowSpanish] = useState<Content[]>([]);
  const [rowUK, setRowUK] = useState<Content[]>([]);
  const [rowAustralia, setRowAustralia] = useState<Content[]>([]);
  const [rowCanada, setRowCanada] = useState<Content[]>([]);
  const [rowBrazil, setRowBrazil] = useState<Content[]>([]);
  const [rowGermany, setRowGermany] = useState<Content[]>([]);
  const [rowMoodContent, setRowMoodContent] = useState<{title: string; items: Content[]} | null>(null);
  const [actorCollections, setActorCollections] = useState<Array<{actor: string; content: Content[]; profilePath: string | null}>>([]);
  const [franchiseCollections, setFranchiseCollections] = useState<Array<{name: string; content: Content[]}>>([]);
  const [rowForYou, setRowForYou] = useState<Content[]>([]);
  const [isLoadingForYou, setIsLoadingForYou] = useState(false);
  const [top10Content, setTop10Content] = useState<Content[]>([]);
  const [isLoadingTop10, setIsLoadingTop10] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Content[]>([]);
  const [isLoadingRecentlyAdded, setIsLoadingRecentlyAdded] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  // Run small data migrations on boot (e.g., Sopranos ID fix)
  useEffect(() => {
    migrateKnownFixes();
  }, []);

  // Setup player event tracking
  usePlayerTracking();
  
  // Setup TV remote navigation
  useTVNavigation();

  // Load top 10 trending content
  useEffect(() => {
    const loadTop10 = async () => {
      setIsLoadingTop10(true);
      try {
        const top10 = await getTop10();
        setTop10Content(top10);
      } catch (error) {
        console.error('Error loading top 10:', error);
      } finally {
        setIsLoadingTop10(false);
      }
    };

    loadTop10();
  }, []);

  // Load AI-powered "For You" recommendations
  useEffect(() => {
    const loadForYou = async () => {
      setIsLoadingForYou(true);
      try {
        const forYou = await getForYouContent();
        setRowForYou(forYou);
      } catch (error) {
        console.error('Error loading For You:', error);
      } finally {
        setIsLoadingForYou(false);
      }
    };

    loadForYou();
  }, [continueWatching]);
  // Update My List on custom storage events
  useEffect(() => {
    const onListChange = () => setRowMyList(getMyList());
    window.addEventListener('flux:list:changed', onListChange);
    return () => window.removeEventListener('flux:list:changed', onListChange);
  }, []);

  // Because you watched: build from most recent continue watching item
  useEffect(() => {
    const buildBecause = async () => {
      if (continueWatching.length === 0) { setRowBecause({title:'', items: []}); return; }
      const anchor = continueWatching[0];
      try {
        const recs = await getRecommendations(anchor.type, anchor.id);
        setRowBecause({ title: `Because you watched ${anchor.title}`, items: recs.slice(0, 40) });
      } catch {
        setRowBecause({title:'', items: []});
      }
    };
    buildBecause();
  }, [continueWatching]);

  // Load additional dynamic rows (Netflix/Disney+ style variety)
  useEffect(() => {
    const loadRows = async () => {
      try {
        // Action Spectacle (genre 28 movies + 10759 TV Action & Adventure)
        const [actionMovies, actionTV] = await Promise.all([
          getByGenre('movie', 28, 40),
          getByGenre('tv', 10759, 40),
        ]);
        setRowAction([...actionMovies.slice(0, 30), ...actionTV.slice(0, 30)]);

        // Laugh Tonight (Comedy movies + TV)
        const [comedyMovies, comedyTV] = await Promise.all([
          getByGenre('movie', 35, 40),
          getByGenre('tv', 35, 40),
        ]);
        setRowComedy([...comedyMovies.slice(0, 30), ...comedyTV.slice(0, 30)]);

        // Dark & Moody (Thriller/Horror)
        const [thrillerMovies, horrorMovies, thrillerTV] = await Promise.all([
          getByGenre('movie', 53, 30),
          getByGenre('movie', 27, 30),
          getByGenre('tv', 80, 30), // crime as proxy for moody TV
        ]);
        const darkMix = [...thrillerMovies.slice(0, 20), ...horrorMovies.slice(0, 20), ...thrillerTV.slice(0, 20)];
        setRowDarkMoody(darkMix);

        // Family Night (Animation + Family)
        const [familyMovies, animationMovies, familyTV] = await Promise.all([
          getByGenre('movie', 10751, 30),
          getByGenre('movie', 16, 30),
          getByGenre('tv', 10762, 30), // Kids TV
        ]);
        setRowFamily([...familyMovies.slice(0, 20), ...animationMovies.slice(0, 20), ...familyTV.slice(0, 20)]);

        // Science Fiction (dedicated bucket)
        const sciFi = await getScienceFictionContent(36);
        setRowScienceFiction(sciFi);

        // Romantic Comedy (dedicated bucket)
        const romcom = await getRomanticComedyContent(30);
        setRowRomanticComedy(romcom);

        // Coming Soon (upcoming movies)
        const upcoming = await getUpcomingMovies();
        setRowComingSoon(upcoming.slice(0, 40));

        // Critically Acclaimed (high-rated content)
        const acclaimed = await getCriticallyAcclaimed();
        setRowCriticallyAcclaimed(acclaimed);

        // Hidden Gems (underrated high-quality content)
        const hiddenGems = await getHiddenGems();
        setRowHiddenGems(hiddenGems);

        // Female directors + LGBT themes
        const [femaleDirected, lgbtContent] = await Promise.all([
          getFemaleDirectedContent(),
          getLGBTContent(),
        ]);
        setRowFemaleDirectors(femaleDirected);
        setRowLGBT(lgbtContent);

        // Trending Today (real-time trending)
        const trendingToday = await getTrendingToday();
        setRowTrendingToday(trendingToday);

        // Regional pools
        const [spanish, uk, australia, canada, brazil, germany] = await Promise.all([
          getRegionalContent('spanish'),
          getRegionalContent('uk'),
          getRegionalContent('australia'),
          getRegionalContent('canada'),
          getRegionalContent('brazil'),
          getRegionalContent('germany'),
        ]);
        setRowSpanish(spanish);
        setRowUK(uk);
        setRowAustralia(australia);
        setRowCanada(canada);
        setRowBrazil(brazil);
        setRowGermany(germany);

        // Recently Added (new releases from last 30 days)
        setIsLoadingRecentlyAdded(true);
        try {
          const recentlyAddedContent = await getRecentlyAdded();
          setRecentlyAdded(recentlyAddedContent);
        } catch (error) {
          console.error('Error loading recently added:', error);
        } finally {
          setIsLoadingRecentlyAdded(false);
        }

        // Actor Collections (popular actors)
        const popularActors = ['Adam Sandler', 'Tom Hanks', 'Leonardo DiCaprio', 'Ryan Reynolds'];
        const actorResults = await Promise.all(
          popularActors.map(actor => getMoviesByActor(actor))
        );
        setActorCollections(
          actorResults
            .filter((r): r is { actor: string; content: Content[]; profilePath: string | null } => r !== null && r.content && r.content.length > 0)
            .slice(0, 3)
        );

        // Franchise Collections (popular franchises)
        // Find collections by known movie IDs
        const franchiseMovies = [
          { movieId: 671, name: 'Harry Potter Collection' }, // Harry Potter and the Philosopher's Stone
          { movieId: 181808, name: 'Star Wars Collection' }, // Star Wars: The Last Jedi (to get collection)
          { movieId: 299536, name: 'Avengers Collection' }, // Avengers: Infinity War
        ];
        const franchiseResults = await Promise.all(
          franchiseMovies.map(f => findCollectionByMovie(f.movieId))
        );
        setFranchiseCollections(
          franchiseResults
            .filter((r): r is { name: string; content: Content[] } => r !== null && r.content.length > 0)
            .slice(0, 3)
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error loading dynamic rows:', e);
      }
    };

    loadRows();
  }, []);

  // Load trending content for hero and rows
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const [movies, tv] = await Promise.all([
          getTrendingMovies(),
          getTrendingTV(),
        ]);
        const combined = [...movies, ...tv];
        setTrendingMovies(combined.length > 0 ? combined : []);
      } catch (error) {
        console.error('Error loading trending content:', error);
        setTrendingMovies([]);
      }
    };

    loadTrending();
  }, []);

  const handleMoodSelect = (moodTitle: string, content: Content[]) => {
    setRowMoodContent({ title: moodTitle, items: content });
    // Scroll to mood content
    setTimeout(() => {
      const element = document.querySelector('.mood-content-section');
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Load hero content based on category
  useEffect(() => {
    const loadHeroContent = async () => {
      setIsLoadingHero(true);
      try {
        // Use getRandomHero to fetch 5 unique random items with image backdrops only
        const { getRandomHero } = await import('./utils/wikidataAdapter');
        const type = currentCategory === 'movies' ? 'movie' : 'all';
        const items: Content[] = [];
        const ids = new Set<string>();
        const isVideoUrl = (url: string) => /\.(webm|mp4|ogv|ogg|mkv)(\?|$)/i.test(url);
        // Try to get 5 unique items with image backdrops only
        for (let i = 0; i < 20 && items.length < 5; i++) {
          const item = await getRandomHero(type);
          const backdrop = item?.backdrop || '';
          if (item && !ids.has(item.id) && backdrop && !isVideoUrl(backdrop)) {
            items.push(item);
            ids.add(item.id);
          }
        }
        setHeroContent(items);
      } catch (error) {
        console.error('Error loading hero content:', error);
        setHeroContent([]);
      } finally {
        setIsLoadingHero(false);
      }
    };
    loadHeroContent();
  }, [currentCategory]);

  // Debounced TMDB search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchTMDB(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // Debounce 500ms

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Filter content based on category and search
  const filteredContent = useMemo(() => {
    const filterByCategory = (items: Content[]) => {
      if (currentCategory === 'movies') return items.filter(i => i.type === 'movie');
      return items;
    };

    return {
      continue: filterByCategory(continueWatching),
      trending: filterByCategory(trendingMovies),
    };
  }, [currentCategory, continueWatching, trendingMovies]);
  const filteredRowMyList = useMemo(() => {
    if (currentCategory === 'movies') return rowMyList.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowMyList.filter(i => i.type === 'tv');
    return rowMyList;
  }, [currentCategory, rowMyList]);

  const filteredRowForYou = useMemo(() => {
    if (currentCategory === 'movies') return rowForYou.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowForYou.filter(i => i.type === 'tv');
    return rowForYou;
  }, [currentCategory, rowForYou]);

  const filteredRowBecause = useMemo(() => {
    if (currentCategory === 'movies') {
      return {
        title: rowBecause.title,
        items: rowBecause.items.filter(i => i.type === 'movie'),
      };
    }
    if (currentCategory === 'tv') {
      return {
        title: rowBecause.title,
        items: rowBecause.items.filter(i => i.type === 'tv'),
      };
    }
    return rowBecause;
  }, [currentCategory, rowBecause]);

  const filteredRowAction = useMemo(() => {
    if (currentCategory === 'movies') return rowAction.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowAction.filter(i => i.type === 'tv');
    return rowAction;
  }, [currentCategory, rowAction]);

  const filteredRowComedy = useMemo(() => {
    if (currentCategory === 'movies') return rowComedy.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowComedy.filter(i => i.type === 'tv');
    return rowComedy;
  }, [currentCategory, rowComedy]);

  const filteredRowDarkMoody = useMemo(() => {
    if (currentCategory === 'movies') return rowDarkMoody.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowDarkMoody.filter(i => i.type === 'tv');
    return rowDarkMoody;
  }, [currentCategory, rowDarkMoody]);

  const filteredRowFamily = useMemo(() => {
    if (currentCategory === 'movies') return rowFamily.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowFamily.filter(i => i.type === 'tv');
    return rowFamily;
  }, [currentCategory, rowFamily]);

  const filteredRowScienceFiction = useMemo(() => {
    if (currentCategory === 'movies') return rowScienceFiction.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowScienceFiction.filter(i => i.type === 'tv');
    return rowScienceFiction;
  }, [currentCategory, rowScienceFiction]);

  const filteredRowRomanticComedy = useMemo(() => {
    if (currentCategory === 'movies') return rowRomanticComedy.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowRomanticComedy.filter(i => i.type === 'tv');
    return rowRomanticComedy;
  }, [currentCategory, rowRomanticComedy]);

  const filteredRowTrendingToday = useMemo(() => {
    if (currentCategory === 'movies') return rowTrendingToday.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowTrendingToday.filter(i => i.type === 'tv');
    return rowTrendingToday;
  }, [currentCategory, rowTrendingToday]);

  const filteredRowMoodContent = useMemo(() => {
    if (!rowMoodContent) return null;
    if (currentCategory === 'movies') {
      return {
        title: rowMoodContent.title,
        items: rowMoodContent.items.filter(i => i.type === 'movie'),
      };
    }
    if (currentCategory === 'tv') {
      return {
        title: rowMoodContent.title,
        items: rowMoodContent.items.filter(i => i.type === 'tv'),
      };
    }
    return rowMoodContent;
  }, [currentCategory, rowMoodContent]);

  const filteredRowComingSoon = useMemo(() => {
    if (currentCategory === 'movies') return rowComingSoon.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowComingSoon.filter(i => i.type === 'tv');
    return rowComingSoon;
  }, [currentCategory, rowComingSoon]);

  const filteredRowCriticallyAcclaimed = useMemo(() => {
    if (currentCategory === 'movies') return rowCriticallyAcclaimed.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowCriticallyAcclaimed.filter(i => i.type === 'tv');
    return rowCriticallyAcclaimed;
  }, [currentCategory, rowCriticallyAcclaimed]);

  const filteredRowHiddenGems = useMemo(() => {
    if (currentCategory === 'movies') return rowHiddenGems.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowHiddenGems.filter(i => i.type === 'tv');
    return rowHiddenGems;
  }, [currentCategory, rowHiddenGems]);

  const filteredRowFemaleDirectors = useMemo(() => {
    if (currentCategory === 'movies') return rowFemaleDirectors.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowFemaleDirectors.filter(i => i.type === 'tv');
    return rowFemaleDirectors;
  }, [currentCategory, rowFemaleDirectors]);

  const filteredRowLGBT = useMemo(() => {
    if (currentCategory === 'movies') return rowLGBT.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowLGBT.filter(i => i.type === 'tv');
    return rowLGBT;
  }, [currentCategory, rowLGBT]);

  const filteredRowSpanish = useMemo(() => {
    if (currentCategory === 'movies') return rowSpanish.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowSpanish.filter(i => i.type === 'tv');
    return rowSpanish;
  }, [currentCategory, rowSpanish]);

  const filteredRowUK = useMemo(() => {
    if (currentCategory === 'movies') return rowUK.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowUK.filter(i => i.type === 'tv');
    return rowUK;
  }, [currentCategory, rowUK]);

  const filteredRowAustralia = useMemo(() => {
    if (currentCategory === 'movies') return rowAustralia.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowAustralia.filter(i => i.type === 'tv');
    return rowAustralia;
  }, [currentCategory, rowAustralia]);

  const filteredRowCanada = useMemo(() => {
    if (currentCategory === 'movies') return rowCanada.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowCanada.filter(i => i.type === 'tv');
    return rowCanada;
  }, [currentCategory, rowCanada]);

  const filteredRowBrazil = useMemo(() => {
    if (currentCategory === 'movies') return rowBrazil.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowBrazil.filter(i => i.type === 'tv');
    return rowBrazil;
  }, [currentCategory, rowBrazil]);

  const filteredRowGermany = useMemo(() => {
    if (currentCategory === 'movies') return rowGermany.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return rowGermany.filter(i => i.type === 'tv');
    return rowGermany;
  }, [currentCategory, rowGermany]);

  const filteredTop10Content = useMemo(() => {
    if (currentCategory === 'movies') return top10Content.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return top10Content.filter(i => i.type === 'tv');
    return top10Content;
  }, [currentCategory, top10Content]);

  const filteredRecentlyAdded = useMemo(() => {
    if (currentCategory === 'movies') return recentlyAdded.filter(i => i.type === 'movie');
    if (currentCategory === 'tv') return recentlyAdded.filter(i => i.type === 'tv');
    return recentlyAdded;
  }, [currentCategory, recentlyAdded]);

  // Map existing pools to the Wikiflix category structure from the reference UI
  const curatedDocRows = useMemo(() => {
    const pool = filteredContent.trending.length > 0 ? filteredContent.trending : filteredRowHiddenGems;
    const safePool = pool.filter(c => Boolean(c.poster));
    const takeSlice = (start: number, count = 6) => safePool.slice(start, start + count);
    const rankedPool = filteredTop10Content.length > 0 ? filteredTop10Content : filteredRowCriticallyAcclaimed;

    return {
      recentlyEdited: filteredRecentlyAdded,
      highlyRanked: rankedPool.length > 0 ? rankedPool : safePool,
      mostViewed: filteredRowTrendingToday.length > 0 ? filteredRowTrendingToday : safePool,
      femaleDirectors: filteredRowFemaleDirectors.length > 0 ? filteredRowFemaleDirectors : safePool,
      spanish: filteredRowSpanish.length > 0 ? filteredRowSpanish : takeSlice(0),
      uk: filteredRowUK.length > 0 ? filteredRowUK : takeSlice(6),
      australia: filteredRowAustralia.length > 0 ? filteredRowAustralia : takeSlice(12),
      canada: filteredRowCanada.length > 0 ? filteredRowCanada : takeSlice(18),
      brazil: filteredRowBrazil.length > 0 ? filteredRowBrazil : takeSlice(24),
      germany: filteredRowGermany.length > 0 ? filteredRowGermany : takeSlice(30),
      animatedCartoon: filteredRowFamily,
      thrillerHorror: filteredRowDarkMoody,
      scienceFiction: filteredRowScienceFiction.length > 0 ? filteredRowScienceFiction : filteredRowAction,
      lgbt: filteredRowLGBT.length > 0 ? filteredRowLGBT : filteredRowHiddenGems.slice(0, 12),
      children: filteredRowFamily,
      romanticComedy: filteredRowRomanticComedy.length > 0 ? filteredRowRomanticComedy : filteredRowComedy,
    };
  }, [
    filteredContent.trending,
    filteredRowHiddenGems,
    filteredRowTrendingToday,
    filteredRowFamily,
    filteredRowDarkMoody,
    filteredRowAction,
    filteredRowComedy,
    filteredRowScienceFiction,
    filteredRowRomanticComedy,
    filteredRowFemaleDirectors,
    filteredRowLGBT,
    filteredRowSpanish,
    filteredRowUK,
    filteredRowAustralia,
    filteredRowCanada,
    filteredRowBrazil,
    filteredRowGermany,
    filteredRecentlyAdded,
    filteredTop10Content,
    filteredRowCriticallyAcclaimed,
  ]);

  const handlePlayContent = (content: Content) => {
    setSelectedContent(content);
    addToContinueWatching(content);
    setContinueWatching(getContinueWatching());
  };

  const handleClosePlayer = () => {
    setSelectedContent(null);
    setContinueWatching(getContinueWatching());
  };

  const handleInfo = (content: Content) => {
    setInfoContent(content);
  };

  const handleShuffle = async () => {
    try {
      // Pick a truly random item from the full catalog (image backdrop only)
      const random = await getRandomHero('all');
      if (random) handlePlayContent(random);
    } catch (error) {
      console.error('Error shuffling:', error);
    }
  };

  const handleHelp = () => {
    alert('Keyboard Shortcuts:\n\n' +
          'In Player:\n' +
          '  Space - Play/Pause\n' +
          '  ← → - Seek backward/forward 10s\n' +
          '  M - Mute/Unmute\n' +
          '  F - Fullscreen\n' +
          '  ESC - Close player'
    );
  };

  // Use dynamic hero content from TMDB or fallback to featured content
  const displayedHeroContent = useMemo(() => {
    // If searching, prioritize search results as hero and keep only items with images
    const isVideoUrl = (url: string) => /\.(webm|mp4|ogv|ogg|mkv)(\?|$)/i.test(url);
    const hasBackdrop = (c: Content | null | undefined) => {
      const src = c?.backdrop?.trim() || '';
      if (!src) return false;
      if (isVideoUrl(src)) return false;
      return true;
    };
    if (searchQuery.trim() && searchResults.length > 0) {
      const withImages = searchResults.filter(hasBackdrop);
      return withImages.slice(0, 5);
    }
    // Use the 5 random hero items from state
    return heroContent;
  }, [heroContent, searchQuery, searchResults]);

  return (
    <div className="app">
      <Navbar
        currentCategory={currentCategory}
        onCategoryChange={setCurrentCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(val)=>{
          // Navigate to dedicated search page
          window.location.href = `/search?q=${encodeURIComponent(val)}`;
        }}
        onShuffle={handleShuffle}
        onHelp={handleHelp}
      />

      {displayedHeroContent.length > 0 && !isLoadingHero && (
        <Hero
          content={displayedHeroContent}
          onPlay={(content) => handlePlayContent(content)}
          onInfo={(content) => handleInfo(content)}
        />
      )}

      <InfoModal
        content={infoContent}
        onClose={() => setInfoContent(null)}
        onPlay={(c) => handlePlayContent(c)}
      />

      <main className="content">
        {/* Show loading state while searching */}
        {isSearching && searchQuery.trim() && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#b3b3b3' }}>
            <div style={{ fontSize: '1.1rem' }}>🔍 Searching {searchQuery}...</div>
          </div>
        )}

        {/* Show no results message */}
        {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#b3b3b3' }}>
            <div style={{ fontSize: '1.1rem' }}>No results found for "{searchQuery}"</div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Try a different search term</div>
          </div>
        )}

        {/* ===== RECENTLY EDITED / HIGHLY RANKED / MOST VIEWED ===== */}
        {!searchQuery.trim() && currentCategory === 'all' && (
          <>
            {isLoadingRecentlyAdded ? (
              <SectionSkeleton />
            ) : curatedDocRows.recentlyEdited.length > 0 && (
              <ContentGrid
                title="Recently Edited"
                items={curatedDocRows.recentlyEdited}
                onCardClick={handlePlayContent}
              />
            )}

            {isLoadingTop10 ? (
              <SectionSkeleton />
            ) : curatedDocRows.highlyRanked.length > 0 && (
              <ContentGrid
                title="Highly Ranked"
                items={curatedDocRows.highlyRanked}
                onCardClick={handlePlayContent}
              />
            )}

            {curatedDocRows.mostViewed.length > 0 && (
              <ContentGrid
                title="Most Viewed Movies"
                items={curatedDocRows.mostViewed}
                onCardClick={handlePlayContent}
              />
            )}
          </>
        )}

        {/* ===== PERSONAL SECTION ===== */}
        {/* Continue Watching */}
        {filteredContent.continue.length > 0 && (
          <ContentGrid
            title="Continue Watching"
            items={filteredContent.continue}
            onCardClick={handlePlayContent}
            featured={true}
          />
        )}

        {/* My List */}
        {!isSearching && filteredRowMyList.length > 0 && (
          <ContentGrid
            title="My List"
            items={filteredRowMyList}
            onCardClick={handlePlayContent}
          />
        )}

        {/* For You - personalized recommendations */}
        {!isSearching && (
          <>
            {isLoadingForYou ? (
              <SectionSkeleton />
            ) : filteredRowForYou.length > 0 && (
              <ContentGrid
                title="For You"
                items={filteredRowForYou}
                onCardClick={handlePlayContent}
              />
            )}
          </>
        )}

        {/* Because you watched */}
        {!isSearching && filteredRowBecause.items.length > 0 && (
          <ContentGrid
            title={filteredRowBecause.title}
            items={filteredRowBecause.items}
            onCardClick={handlePlayContent}
          />
        )}

        {/* Mood Selector - only on home */}
        {!searchQuery.trim() && currentCategory === 'all' && !rowMoodContent && (
          <MoodSelector onSelect={handleMoodSelect} />
        )}

        {/* Mood-based content */}
        {!isSearching && filteredRowMoodContent && (
          <div className="mood-content-section">
            <ContentGrid
              title={filteredRowMoodContent.title}
              items={filteredRowMoodContent.items}
              onCardClick={handlePlayContent}
            />
            <button 
              className="clear-mood-btn"
              onClick={() => setRowMoodContent(null)}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
            >
              Clear & Browse More
            </button>
          </div>
        )}

        {/* ===== FEMALE DIRECTORS ===== */}
        {!isSearching && curatedDocRows.femaleDirectors.length > 0 && (
          <ContentSquareGrid
            title="Female Directors"
            items={curatedDocRows.femaleDirectors}
            onCardClick={handlePlayContent}
          />
        )}

        {/* ===== GENRE / THEMATIC ROWS (from reference UI) ===== */}
        {!isSearching && curatedDocRows.animatedCartoon.length > 0 && (
          <ContentGrid
            title="Animated Cartoon"
            items={curatedDocRows.animatedCartoon}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.thrillerHorror.length > 0 && (
          <ContentGrid
            title="Thriller / Horror"
            items={curatedDocRows.thrillerHorror}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.scienceFiction.length > 0 && (
          <ContentGrid
            title="Science Fiction"
            items={curatedDocRows.scienceFiction}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.lgbt.length > 0 && (
          <ContentGrid
            title="LGBT-Related Film"
            items={curatedDocRows.lgbt}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.children.length > 0 && (
          <ContentGrid
            title="Children's Film"
            items={curatedDocRows.children}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.romanticComedy.length > 0 && (
          <ContentGrid
            title="Romantic Comedy"
            items={curatedDocRows.romanticComedy}
            onCardClick={handlePlayContent}
          />
        )}

        {/* ===== GEOGRAPHIC ROWS ===== */}
        {!isSearching && curatedDocRows.spanish.length > 0 && (
          <ContentGrid
            title="Spanish"
            items={curatedDocRows.spanish}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.uk.length > 0 && (
          <ContentGrid
            title="United Kingdom"
            items={curatedDocRows.uk}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.australia.length > 0 && (
          <ContentGrid
            title="Australia"
            items={curatedDocRows.australia}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.canada.length > 0 && (
          <ContentGrid
            title="Canada"
            items={curatedDocRows.canada}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.brazil.length > 0 && (
          <ContentGrid
            title="Brazil"
            items={curatedDocRows.brazil}
            onCardClick={handlePlayContent}
          />
        )}

        {!isSearching && curatedDocRows.germany.length > 0 && (
          <ContentGrid
            title="Germany"
            items={curatedDocRows.germany}
            onCardClick={handlePlayContent}
          />
        )}

        {/* ===== COLLECTIONS ===== */}
        {/* Franchise Collections - Square Grid */}
        {!isSearching && franchiseCollections.map((collection, idx) => {
          const filteredCollection = currentCategory === 'movies'
            ? collection.content.filter(i => i.type === 'movie')
            : currentCategory === 'tv'
            ? collection.content.filter(i => i.type === 'tv')
            : collection.content;
          
          return filteredCollection.length > 0 && (
            <ContentSquareGrid
              key={`franchise-${idx}`}
              title={`${collection.name}`}
              items={filteredCollection}
              onCardClick={handlePlayContent}
            />
          );
        })}

        {/* Actor Collections - Square Grid */}
        {!isSearching && actorCollections.map((collection, idx) => {
          const filteredCollection = currentCategory === 'movies'
            ? collection.content.filter(i => i.type === 'movie')
            : currentCategory === 'tv'
            ? collection.content.filter(i => i.type === 'tv')
            : collection.content;
          
          return filteredCollection.length > 0 && (
            <ContentSquareGrid
              key={`actor-${idx}`}
              title={`Movies with ${collection.actor}`}
              items={filteredCollection}
              onCardClick={handlePlayContent}
              actorPhoto={collection.profilePath}
            />
          );
        })}

        {/* ===== UPCOMING ===== */}
        {/* Coming Soon */}
        {!isSearching && filteredRowComingSoon.length > 0 && (
          <ContentGrid
            title="Coming Soon"
            items={filteredRowComingSoon}
            onCardClick={handlePlayContent}
          />
        )}

        {/* Search Results */}
        {searchQuery.trim() && filteredContent.trending.length > 0 && (
          <ContentGrid
            title={`Search Results for "${searchQuery}"`}
            items={filteredContent.trending}
            onCardClick={handlePlayContent}
          />
        )}
      </main>

      <PlayerModal
        content={selectedContent}
        onClose={handleClosePlayer}
      />
    </div>
  );
}

export default App;

