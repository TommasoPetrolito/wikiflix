import { Content } from '@/types';
import { useCallback } from 'react';
import { ContentCard } from './ContentCard';
import './Top10Grid.css';

interface Top10GridProps {
  items: Content[];
  onCardClick: (content: Content) => void;
}

export const Top10Grid = ({ items, onCardClick }: Top10GridProps) => {
  const handlePreviewChange = useCallback((active: boolean) => {
    // Bubble a custom event so App/Hero can pause banner as a fallback signal
    const ev = new CustomEvent('flux:preview', { detail: { active } });
    window.dispatchEvent(ev);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="top10-row">
      <div className="row-header">
        <h2 className="row-title">
          <span className="top10-title-main">TOP 10</span>
          <span className="top10-title-sub">CONTENT TODAY</span>
        </h2>
      </div>
      <div className="top10-grid">
        {items.map((item, index) => (
          <div key={`${item.type}-${item.id}`} className="top10-item">
            <div className="top10-number">{index + 1}</div>
            <ContentCard
              content={item}
              onClick={() => onCardClick(item)}
              onPreviewChange={handlePreviewChange}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

