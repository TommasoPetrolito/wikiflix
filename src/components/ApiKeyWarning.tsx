import { useState, useEffect } from 'react';
import './ApiKeyWarning.css';

export const ApiKeyWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [hasKey, setHasKey] = useState(true);

  useEffect(() => {
    // Check if TMDB API key is configured
    const tmdbKey = import.meta.env.VITE_TMDB_API_KEY;
    const isConfigured = tmdbKey && 
                         tmdbKey.trim() !== '' && 
                         !tmdbKey.includes('your_') &&
                         tmdbKey.length > 10;
    
    setHasKey(isConfigured);
    setShowWarning(!isConfigured);
  }, []);

  if (!showWarning || hasKey) return null;

  return (
    <div className="api-key-warning">
      <div className="api-key-warning-content">
        <div className="api-key-warning-icon">🔑</div>
        <div className="api-key-warning-text">
          <h3>API Key Required</h3>
          <p>Add your TMDB API key to <code>.env</code> to unlock 75,000+ movies and TV shows</p>
          <div className="api-key-warning-steps">
            <ol>
              <li>Get free API key: <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer">themoviedb.org/settings/api</a></li>
              <li>Open <code>.env</code> file in the project root</li>
              <li>Replace <code>your_tmdb_api_key_here</code> with your actual key</li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        </div>
        <button 
          className="api-key-warning-close"
          onClick={() => setShowWarning(false)}
          aria-label="Dismiss warning"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

