import React, { useState, useRef, useEffect } from 'react';
import { Content } from '@/types';
import { getProgress } from '@/utils/storage';
import './ContentCard.css';

interface ContentCardProps {
  content: Content;
  onClick: () => void;
  onPreviewChange?: (active: boolean) => void;
  variant?: 'default' | 'square';
}

export const ContentCard = ({ content, onClick, onPreviewChange, variant = 'default' }: ContentCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const moveAccumRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const progress = getProgress(content.id, content.type);
  // Keyboard support for TV remotes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // Show preview on focus (for TV remote navigation) - with same delay as hover
  const handleFocus = () => {
    setIsFocused(true);
    if (variant !== 'square') {
      // Same intentional delay as mouse hover (1500ms)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      enterTimerRef.current = setTimeout(() => {
        setIsHovered(true);
        if (onPreviewChange) onPreviewChange(true);
      }, 1500);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (variant !== 'square') {
      // Clear any pending preview timer
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
      // Small exit delay to avoid flicker (same as mouse leave)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = setTimeout(() => {
        setIsHovered(false);
        if (onPreviewChange) onPreviewChange(false);
      }, 180);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    moveAccumRef.current = 0;
    enterTimerRef.current = setTimeout(() => {
      setIsHovered(true);
      if (onPreviewChange) onPreviewChange(true);
    }, 1500); // stronger intent delay
  };

  const handleMouseLeave = () => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
      if (onPreviewChange) onPreviewChange(false);
    }, 180); // small exit delay to avoid flicker
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isHovered) return;
    if (!lastPosRef.current) {
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    moveAccumRef.current += Math.hypot(dx, dy);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    // If the user is still moving the mouse, keep delaying the preview
    if (enterTimerRef.current && moveAccumRef.current > 24) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = setTimeout(() => setIsHovered(true), 1500);
      moveAccumRef.current = 0;
    }
  };

  // Fetch trailer when hovered
  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const getPosterUrl = (path: string | null) => {
    if (!path) return '/placeholder.jpg';
    if (/^https?:\/\//i.test(path)) return path;
    return `https://image.tmdb.org/t/p/w500${path}`;
  };

  return (
    <>
      {/* Backdrop when card is expanded */}
      {isHovered && <div className="card-backdrop" />}
      
      <div 
        ref={cardRef}
        className={`content-card ${isHovered ? 'expanded' : ''} ${variant === 'square' ? 'square-variant' : ''} ${isFocused ? 'focused' : ''}`}
        onClick={onClick}
        onMouseEnter={variant === 'square' ? undefined : handleMouseEnter}
        onMouseLeave={variant === 'square' ? undefined : handleMouseLeave}
        onMouseMove={variant === 'square' ? undefined : handleMouseMove}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${content.title} ${content.type === 'movie' ? 'Movie' : 'TV Show'} ${content.year}`}
      >
        {!imageError ? (
          <img 
            src={getPosterUrl(content.poster)} 
            alt={content.title} 
            className="card-poster"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="card-fallback">
            <svg className="card-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {content.type === 'movie' ? (
                <>
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="7 2 12 7 17 2"></polyline>
                </>
              ) : (
                <>
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                  <polyline points="17 2 12 7 7 2"></polyline>
                  <line x1="12" y1="17" x2="12" y2="17.01"></line>
                </>
              )}
            </svg>
            <div className="card-fallback-title">{content.title}</div>
            <div className="card-fallback-year">{content.year}</div>
            <div className="card-fallback-type">{content.type === 'movie' ? 'Movie' : 'TV Show'}</div>
          </div>
        )}
        
        <div className="card-overlay">
          <div className="card-title">{content.title}</div>
          <div className="card-meta">
            <span>{content.year}</span>
            <span>•</span>
            <span>{content.type === 'movie' ? 'Movie' : 'TV Show'}</span>
          </div>
        </div>
        
        {progress && (
          <div className="card-progress">
            <div className="card-progress-bar" style={{ width: `${progress.progress}%` }}></div>
          </div>
        )}
      </div>
    </>
  );
};

