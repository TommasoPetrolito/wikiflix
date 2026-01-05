import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Content } from '@/types';
import './PlayerModal.css';

interface PlayerModalProps {
  content: Content | null;
  onClose: () => void;
}

export const PlayerModal = ({ content, onClose }: PlayerModalProps) => {
  const USE_IFRAME_PLAYER = false; // Force HTML5 player; no iframe fallback to avoid X-Frame-Options issues
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useHtml5, setUseHtml5] = useState(true);
  const [localSubtitleUrl, setLocalSubtitleUrl] = useState<string | null>(null);
  const [localSubtitleLabel, setLocalSubtitleLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const closeOnEsc = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', closeOnEsc);
    return () => window.removeEventListener('keydown', closeOnEsc);
  }, [closeOnEsc]);

  useEffect(() => {
    if (!content) return;
    setError(null);
    setIsReady(false);
    setUseHtml5(true);
    // Reset local subtitles when content changes
    if (localSubtitleUrl) {
      URL.revokeObjectURL(localSubtitleUrl);
      setLocalSubtitleUrl(null);
      setLocalSubtitleLabel(null);
    }
  }, [content]);

  useEffect(() => {
    return () => {
      if (localSubtitleUrl) {
        URL.revokeObjectURL(localSubtitleUrl);
      }
    };
  }, [localSubtitleUrl]);

  const toCommonsFilePath = (url: string) => {
    if (!url) return '';
    const httpsUrl = url.replace(/^http:\/\//i, 'https://');

    // Bare filename -> FilePath
    if (!/^https?:\/\//i.test(httpsUrl)) {
      const decoded = decodeURIComponent(httpsUrl);
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}`;
    }

    // Already FilePath
    if (httpsUrl.includes('Special:FilePath')) return httpsUrl;

    // File: URLs
    const fileMatch = httpsUrl.match(/File:(.+)$/);
    if (fileMatch) {
      const decoded = decodeURIComponent(fileMatch[1]);
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}`;
    }

    // upload.wikimedia: extract filename from path
    try {
      const u = new URL(httpsUrl);
      const segments = u.pathname.split('/').filter(Boolean);
      const filename = segments[segments.length - 1];
      if (filename) {
        const decoded = decodeURIComponent(filename);
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}`;
      }
    } catch (e) {
      // fall through
    }

    return httpsUrl;
  };

  const videoSource = content?.videoUrl || '';
  const filePathSource = toCommonsFilePath(videoSource);
  const iframeSrc = filePathSource;
  const isDirectMedia = /\.(webm|mp4|ogv|ogg|mkv)(\?|$)/i.test(videoSource) || /upload\.wikimedia\.org/.test(videoSource) || /Special:FilePath/.test(filePathSource);
  const guessMime = (url: string) => {
    if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
    if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4';
    if (/(\.ogv|\.ogg)(\?|$)/i.test(url)) return 'video/ogg';
    if (/\.mkv(\?|$)/i.test(url)) return 'video/x-matroska';
    return undefined;
  };

  const iframeFallbackSrc = filePathSource;

  // Derive alternative sources (e.g., try .webm if .ogg/.ogv struggles)
  const derivedSources: Array<{ src: string; type?: string }> = [];
  const addDerived = (src: string) => {
    if (!src) return;
    if (derivedSources.some((s) => s.src === src)) return;
    derivedSources.push({ src, type: guessMime(src) });
  };

  const maybeAddWebmVariant = (url: string) => {
    if (!url) return;
    if (/\.(ogv|ogg)(\?|$)/i.test(url)) {
      addDerived(url.replace(/\.(ogv|ogg)(\?|$)/i, '.webm$2'));
    }
  };

  maybeAddWebmVariant(videoSource);
  maybeAddWebmVariant(filePathSource);

  const subtitleTracks: Array<{ src: string; lang?: string; label: string }> = [];
  if (content?.subtitles) {
    subtitleTracks.push({ src: toCommonsFilePath(content.subtitles), lang: 'en', label: 'Subtitles' });
  }
  if (localSubtitleUrl) {
    subtitleTracks.push({ src: localSubtitleUrl, lang: 'en', label: localSubtitleLabel || 'Local subtitles' });
  }

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleSubtitleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Simple VTT only; user-provided
    const url = URL.createObjectURL(file);
    if (localSubtitleUrl) URL.revokeObjectURL(localSubtitleUrl);
    setLocalSubtitleUrl(url);
    setLocalSubtitleLabel(file.name);
  };

  if (!content) return null;

  const videoKey = content.id; // Force remount on content change to reset iframe

  return (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close player">×</button>
        <div className="player-header">
          <div>
            <h2>{content.title}</h2>
            {content.description && <p className="player-description">{content.description}</p>}
          </div>
          <div className="player-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="secondary-button" onClick={handleUploadClick} style={{ padding: '0.35rem 0.65rem' }}>
              Carica sottotitoli (.vtt)
            </button>
            <input
              type="file"
              accept=".vtt,text/vtt"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleSubtitleFile}
            />
            {localSubtitleLabel && <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Usando: {localSubtitleLabel}</span>}
            {isReady && <span className="player-progress">Player pronto</span>}
          </div>
        </div>

        {videoSource ? (
          <video
            key={videoKey}
            className="player-video"
            controls
            playsInline
            preload="auto"
            poster={content.backdrop || content.poster}
            // Avoid forcing CORS; Commons media often lacks ACAO headers
            referrerPolicy="no-referrer"
            onLoadedData={() => setIsReady(true)}
            onError={() => {
              setError('Impossibile caricare il video');
              setUseHtml5(false);
            }}
          >
            <source src={videoSource} type={guessMime(videoSource)} />
            {filePathSource && filePathSource !== videoSource && (
              <source src={filePathSource} type={guessMime(filePathSource)} />
            )}
            {derivedSources.map((s, idx) => (
              <source key={idx} src={s.src} type={s.type} />
            ))}
            {subtitleTracks.map((t, idx) => (
              <track key={`sub-${idx}-${t.src}`} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} default={idx === 0} />
            ))}
          </video>
        ) : (
          <div className="player-fallback">
            <p>Video not available for this title.</p>
          </div>
        )}

        {error && (
          <div className="player-fallback" style={{ color: '#f88' }}>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

