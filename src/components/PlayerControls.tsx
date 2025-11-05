import { useState, useEffect } from 'react';
import './PlayerControls.css';

interface PlayerControlsProps {
  onSpeedChange: (speed: number) => void;
  onSkipRecap: () => void;
  hasRecap: boolean;
  onFullscreen?: () => void;
}

export const PlayerControls = ({ onSpeedChange, onSkipRecap, hasRecap, onFullscreen }: PlayerControlsProps) => {
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  // Check fullscreen state
  const checkFullscreen = () => {
    const isFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    setIsFullscreen(isFs);
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      checkFullscreen();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleSpeedClick = (newSpeed: number) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
    setShowSpeedMenu(false);
  };

  const handleFullscreenClick = () => {
    if (onFullscreen) {
      onFullscreen();
    } else {
      // Fallback: try to fullscreen the document
      const exitFullscreen = (): Promise<void> => {
        if (document.exitFullscreen) {
          return document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          return (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          return (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          return (document as any).msExitFullscreen();
        }
        return Promise.reject(new Error('Exit fullscreen not supported'));
      };

      if (isFullscreen) {
        exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="player-controls-overlay">
      <div className="player-controls">
        {hasRecap && (
          <button className="control-btn skip-recap" onClick={onSkipRecap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>
            </svg>
            Skip Recap
          </button>
        )}
        
        <div className="speed-control">
          <button 
            className="control-btn speed-btn"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            {speed}x
          </button>
          
          {showSpeedMenu && (
            <div className="speed-menu">
              {speeds.map(s => (
                <button
                  key={s}
                  className={`speed-option ${s === speed ? 'active' : ''}`}
                  onClick={() => handleSpeedClick(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen Button */}
        <button className="control-btn" onClick={handleFullscreenClick} title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}>
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

