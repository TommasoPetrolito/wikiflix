import { memo, useMemo } from 'react';
import { Stream } from '@/types';
import './StreamCard.css';

interface StreamCardProps {
  stream: Stream;
  onClick: (stream: Stream) => void;
}

export const StreamCard = memo(({ stream, onClick }: StreamCardProps) => {
  const live = useMemo(() => {
    if (stream.always_live) return true;
    if (!stream.starts_at || !stream.ends_at) return false;
    const now = Date.now();
    const start = new Date(stream.starts_at).getTime();
    const end = new Date(stream.ends_at).getTime();
    return now >= start && now <= end;
  }, [stream.always_live, stream.starts_at, stream.ends_at]);

  const upcoming = useMemo(() => {
    if (live || !stream.starts_at) return false;
    const start = new Date(stream.starts_at).getTime();
    return Date.now() < start;
  }, [live, stream.starts_at]);

  const formattedTime = useMemo(() => {
    if (!stream.starts_at) return '';
    return new Date(stream.starts_at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [stream.starts_at]);
  
  return (
    <div 
      className="stream-card"
      onClick={() => onClick(stream)}
      tabIndex={0}
      role="button"
      aria-label={`${stream.name} - ${stream.category_name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(stream);
        }
      }}
    >
      <div className="stream-card-image-container">
        {stream.poster ? (
          <img 
            src={stream.poster} 
            alt={stream.name}
            className="stream-card-poster"
            loading="lazy"
          />
        ) : (
          <div className="stream-card-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
        )}
        
        {(live || upcoming) && (
          <div className={`stream-badge ${live ? 'live' : 'upcoming'}`}>
            {live ? (
              <>
                <span className="live-dot"></span>
                LIVE
              </>
            ) : (
              'UPCOMING'
            )}
          </div>
        )}
      </div>
      
      <div className="stream-card-overlay">
        <div className="stream-card-title">{stream.name}</div>
        <div className="stream-card-meta">
          <span className="stream-tag">{stream.tag}</span>
          {upcoming && (
            <>
              <span>•</span>
              <span className="stream-time">{formattedTime}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if stream data actually changed
  return prevProps.stream.id === nextProps.stream.id &&
         prevProps.stream.name === nextProps.stream.name &&
         prevProps.stream.iframe === nextProps.stream.iframe &&
         prevProps.stream.starts_at === nextProps.stream.starts_at &&
         prevProps.stream.ends_at === nextProps.stream.ends_at &&
         prevProps.stream.always_live === nextProps.stream.always_live;
});

