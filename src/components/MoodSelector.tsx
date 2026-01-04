import { useState } from 'react';
import { Content } from '@/types';
import { getForYouContent, getHiddenGems, getCriticallyAcclaimed } from '@/utils/wikidataAdapter';
import './MoodSelector.css';

interface MoodSelectorProps {
  onSelect: (mood: string, content: Content[]) => void;
}

export const MoodSelector = ({ onSelect }: MoodSelectorProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const moods = [
    { id: 'feel-good', label: 'Feel-Good', color: '#FFD700', fetch: getForYouContent },
    { id: 'thrilling', label: 'Thrilling', color: '#E50914', fetch: getHiddenGems },
    { id: 'thoughtful', label: 'Thoughtful', color: '#0B84FF', fetch: getCriticallyAcclaimed },
  ];

  const handleMoodClick = async (mood: typeof moods[0]) => {
    setLoading(mood.id);
    try {
      const content = await mood.fetch();
      onSelect(mood.label, content);
    } catch (error) {
      console.error('Error fetching mood content:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mood-selector">
      <h3 className="mood-title">What's Your Mood?</h3>
      <div className="mood-grid">
        {moods.map(mood => (
          <button
            key={mood.id}
            className={`mood-button ${loading === mood.id ? 'loading' : ''}`}
            onClick={() => handleMoodClick(mood)}
            style={{ '--mood-color': mood.color } as React.CSSProperties}
            disabled={loading === mood.id}
            aria-label={`Browse ${mood.label} content`}
          >
            {loading === mood.id ? (
              <span className="mood-spinner">...</span>
            ) : (
              <span className="mood-label">{mood.label}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

