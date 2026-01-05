import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Content, Category } from '@/types';
import {
  searchTMDB,
  getScienceFictionContent,
  getRomanticComedyContent,
  getLGBTContent,
  getFemaleDirectedContent,
  getByGenre,
  getRegionalContent,
  getHiddenGems,
} from '@/utils/wikidataAdapter';
import { ContentCard } from '@/components/ContentCard';
import { PlayerModal } from '@/components/PlayerModal';
import { Navbar } from '@/components/Navbar';
import { useRef as useReactRef } from 'react';
import { useSpatialListNavigation } from '@/hooks/useSpatialListNavigation';
import './AIPage.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Facet = 'sciFi' | 'horror' | 'thriller' | 'comedy' | 'romcom' | 'family' | 'documentary' | 'lgbt' | 'femaleDirector' | 'classic' | 'region-es' | 'region-it' | 'region-de' | 'region-uk' | 'region-br' | 'region-ca' | 'region-au';

const KEYWORD_MAP: Record<Facet, string[]> = {
  sciFi: ['sci-fi', 'science fiction', 'space', 'space opera'],
  horror: ['horror', 'scary', 'haunted'],
  thriller: ['thriller', 'noir', 'mystery', 'suspense'],
  comedy: ['comedy', 'funny', 'humor'],
  romcom: ['romcom', 'rom-com', 'romantic comedy'],
  family: ['family', 'kids', 'children', 'animated', 'animation', 'cartoon', 'cartoons', 'cartoni', 'cartoni animati', 'animazione'],
  documentary: ['documentary', 'docu', 'doc'],
  lgbt: ['lgbt', 'queer', 'gay', 'lesbian'],
  femaleDirector: ['female director', 'woman director', 'women director', 'directed by woman'],
  classic: ['silent', 'classic', '1920s', '1930s', '1940s', '1950s'],
  'region-es': ['spanish', 'spain', 'latin'],
  'region-it': ['italian', 'italy', 'italiano'],
  'region-de': ['german', 'germany', 'deutsch'],
  'region-uk': ['british', 'uk', 'england', 'english'],
  'region-br': ['brazil', 'brazilian', 'portuguese'],
  'region-ca': ['canada', 'canadian'],
  'region-au': ['australia', 'australian'],
};

export default function AIPage() {
  const navigate = useNavigate();
  const [currentCategory, setCurrentCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Describe what you're looking for, and I'll find personalized recommendations from our catalog of 75,000+ movies and TV shows.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Content[]>([]);
  const [typingMessage, setTypingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recGridRef = useReactRef<HTMLDivElement>(null);
  const suggGridRef = useReactRef<HTMLDivElement>(null);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Handle scroll fade indicators
    const scrollContainer = document.querySelector('.recommendations-scroll-container');
    const scrollElement = document.querySelector('.recommendations-grid');
    
    if (!scrollContainer || !scrollElement) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scrollElement as HTMLElement;
      
      // Show left fade if scrolled right
      if (scrollLeft > 10) {
        scrollContainer.classList.add('show-left-fade');
      } else {
        scrollContainer.classList.remove('show-left-fade');
      }
      
      // Show right fade if not at the end
      if (scrollLeft < scrollWidth - clientWidth - 10) {
        scrollContainer.classList.add('show-right-fade');
      } else {
        scrollContainer.classList.remove('show-right-fade');
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [recommendations]);

  // TV remote / D‑pad navigation
  useSpatialListNavigation(recGridRef as any, { itemSelector: '.content-card' });
  useSpatialListNavigation(suggGridRef as any, { itemSelector: '.suggestion-chip' });

  const matchFacets = (userQuery: string): { facets: Set<Facet>; decades: string[]; raw: string } => {
    const q = userQuery.toLowerCase();
    const facets = new Set<Facet>();
    Object.entries(KEYWORD_MAP).forEach(([facet, words]) => {
      if (words.some(w => q.includes(w))) facets.add(facet as Facet);
    });
    const decades: string[] = [];
    const decadeMatch = q.match(/(19[2-5]0)s/);
    if (decadeMatch) decades.push(decadeMatch[1]);
    return { facets, decades, raw: q };
  };

  const buildSearchPlan = (userQuery: string) => {
    const { facets, decades, raw } = matchFacets(userQuery);

    const bucketCalls: Array<() => Promise<Content[]>> = [];
    const cirrusQueries: string[] = [];
    const labels: string[] = [];

    const addBucket = (fn: () => Promise<Content[]>, label: string) => {
      bucketCalls.push(fn);
      labels.push(label);
    };

    if (facets.has('sciFi')) addBucket(() => getScienceFictionContent(18), 'science fiction');
    if (facets.has('horror') || facets.has('thriller')) addBucket(() => getByGenre('movie', 27, 24), 'horror/thriller');
    if (facets.has('comedy')) addBucket(() => getByGenre('movie', 35, 24), 'comedy');
    if (facets.has('romcom')) addBucket(() => getRomanticComedyContent(18), 'romantic comedy');
    if (facets.has('family')) {
      addBucket(() => getByGenre('movie', 10751, 24), 'family');
      addBucket(() => getByGenre('movie', 16, 24), 'animation');
    }
    if (facets.has('lgbt')) addBucket(() => getLGBTContent(18), 'LGBT');
    if (facets.has('femaleDirector')) addBucket(() => getFemaleDirectedContent(18), 'female directors');

    if (facets.has('region-es')) addBucket(() => getRegionalContent('spanish'), 'spanish');
    if (facets.has('region-uk')) addBucket(() => getRegionalContent('uk'), 'uk');
    if (facets.has('region-au')) addBucket(() => getRegionalContent('australia'), 'australia');
    if (facets.has('region-ca')) addBucket(() => getRegionalContent('canada'), 'canada');
    if (facets.has('region-br')) addBucket(() => getRegionalContent('brazil'), 'brazil');
    if (facets.has('region-de')) addBucket(() => getRegionalContent('germany'), 'germany');
    if (facets.has('region-it')) cirrusQueries.push(`${userQuery} italian film trailer`);

    // Cirrus queries
    const base = `${userQuery} film`; // ensure "film" term is present
    cirrusQueries.push(base);

    if (facets.has('family')) {
      cirrusQueries.push(`${userQuery} animated film`);
      cirrusQueries.push(`${userQuery} cartoon film`);
      cirrusQueries.push('big buck bunny');
      cirrusQueries.push('mickey mouse cartoon');
      cirrusQueries.push('open source film');
      cirrusQueries.push('blender open movie');
      cirrusQueries.push('public domain animated film');
    }

    if (facets.has('classic')) {
      cirrusQueries.push(`${userQuery} silent film`);
      cirrusQueries.push(`${userQuery} classic film`);
    }
    decades.forEach(d => {
      cirrusQueries.push(`${userQuery} ${d}s film`);
    });

    if (facets.has('lgbt')) cirrusQueries.push(`${userQuery} lgbt film trailer`);
    if (facets.has('femaleDirector')) cirrusQueries.push(`${userQuery} female director film trailer`);

    // Default guard: if no facets, still keep 2 queries max
    const uniqCirrus = Array.from(new Set(cirrusQueries)).slice(0, 5);

    return { bucketCalls, cirrusQueries: uniqCirrus, labels, raw };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const plan = buildSearchPlan(userMessage);

      const allResults: Content[] = [];
      const seenIds = new Set<string>();

      // Run bucket calls in parallel
      const bucketPromises = plan.bucketCalls.map(fn => fn().catch(() => [] as Content[]));
      const cirrusPromises = plan.cirrusQueries.map(q => searchTMDB(q).catch(() => [] as Content[]));
      const results = await Promise.all([...bucketPromises, ...cirrusPromises]);

      results.flat().forEach(item => {
        const key = `${item.type}-${item.id}`;
        if (!seenIds.has(key) && allResults.length < 12) {
          seenIds.add(key);
          allResults.push(item);
        }
      });

      // Fallback if empty
      if (allResults.length === 0) {
        const fallback = await getHiddenGems();
        fallback.slice(0, 8).forEach(item => {
          const key = `${item.type}-${item.id}`;
          if (!seenIds.has(key)) {
            seenIds.add(key);
            allResults.push(item);
          }
        });
      }

      const message = allResults.length > 0
        ? `Ecco qualche titolo dal catalogo Wikimedia che potrebbe piacerti (${plan.labels.join(', ') || 'mix'}).`
        : "Non ho trovato risultati, riprova con altre parole chiave.";

      // Typewriter effect for AI response
      setIsTyping(true);
      const words = message.split(' ');
      let currentText = '';
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 40));
        currentText += (i > 0 ? ' ' : '') + words[i];
        setTypingMessage(currentText);
      }
      
      setIsTyping(false);
      
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: message,
        },
      ]);
      
      setTypingMessage('');
      setRecommendations(allResults);
    } catch (error) {
      console.error('Recommendation error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble getting recommendations right now. Please try again!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayContent = (content: Content) => {
    setSelectedContent(content);
  };

  const handleClosePlayer = () => {
    setSelectedContent(null);
  };

  const suggestions = [
    'Silent German expressionist horror',
    'Italian romantic comedy',
    'Brazilian classic musical',
    'Female director documentaries',
  ];

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="ai-page">
      <Navbar
        currentCategory={currentCategory}
        onCategoryChange={setCurrentCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      <div className="ai-container">
        <div className="ai-chat-section">
          <div className="ai-chat-content">
            <div className="ai-chat-left">
              <div className="ai-header-inline">
                <h1>AI Recommendations</h1>
                <p>Describe what you want to watch</p>
              </div>
              <div className="ai-messages">
                {messages.map((msg, index) => (
                  <div key={index} className={`ai-message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'assistant' ? 'AI' : 'You'}
                    </div>
                    <div className="message-content">
                      <div className="message-text">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && typingMessage && (
                  <div className="ai-message assistant">
                    <div className="message-avatar">AI</div>
                    <div className="message-content">
                      <div className="message-text">
                        {typingMessage}
                        <span className="typing-cursor">|</span>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && !isTyping && (
                  <div className="ai-message assistant">
                    <div className="message-avatar">AI</div>
                    <div className="message-content">
                      <div className="message-text">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="ai-suggestions-inline">
              <p className="suggestions-label">Quick suggestions:</p>
              <div className="suggestions-grid" ref={suggGridRef as any}>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="suggestion-chip"
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <form className="ai-input-form" onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe what you want to watch..."
                className="ai-input"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                className="ai-submit"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? '...' : '→'}
              </button>
            </form>
          </div>
        </div>

        {isLoading && messages.length > 1 && (
          <div className="ai-recommendations-section">
            <h2 className="recommendations-title">Searching...</h2>
            <div className="loading-skeleton">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="skeleton-card"></div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && recommendations.length > 0 && (
          <div className="ai-recommendations-section">
            <h2 className="recommendations-title">Recommendations</h2>
            <div className="recommendations-scroll-container show-right-fade" id="recommendations-scroll">
              <div className="recommendations-grid" ref={recGridRef as any} tabIndex={0}>
                {recommendations.map((item) => (
                  <ContentCard
                    key={`${item.type}-${item.id}`}
                    content={item}
                    onClick={() => handlePlayContent(item)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <PlayerModal
        content={selectedContent}
        onClose={handleClosePlayer}
      />
    </div>
  );
}

