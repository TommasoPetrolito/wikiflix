import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Content } from '@/types';
import './PlayerModal.css';

interface PlayerModalProps {
  content: Content | null;
  onClose: () => void;
}

export const PlayerModal = ({ content, onClose }: PlayerModalProps) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localSubtitleUrl, setLocalSubtitleUrl] = useState<string | null>(null);
  const [localSubtitleLabel, setLocalSubtitleLabel] = useState<string | null>(null);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);
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
    // Reset local subtitles when content changes
    if (localSubtitleUrl) {
      URL.revokeObjectURL(localSubtitleUrl);
      setLocalSubtitleUrl(null);
      setLocalSubtitleLabel(null);
    }
  }, [content, localSubtitleUrl]);

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

  const extractYouTubeId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu')) {
        if (u.searchParams.get('v')) return u.searchParams.get('v');
        const parts = u.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last) return last;
      }
    } catch (e) {
      // ignore
    }
    const m = url.match(/[?&]v=([\w-]{11})/);
    if (m) return m[1];
    const short = url.match(/youtu\.be\/([\w-]{11})/);
    if (short) return short[1];
    return null;
  };

  const buildYouTubeEmbed = (id: string | null): string | undefined => {
    if (!id) return undefined;
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const qs = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      autoplay: '0',
      playsinline: '1',
      enablejsapi: '1',
      ...(origin ? { origin } : {}),
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${qs.toString()}`;
  };

  const extractArchiveId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('archive.org')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const detailsIdx = parts.indexOf('details');
        if (detailsIdx >= 0 && parts[detailsIdx + 1]) return parts[detailsIdx + 1];
        const embedIdx = parts.indexOf('embed');
        if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      }
    } catch (e) {
      // ignore
    }
    return null;
  };

  type SourceOption = {
    key: string;
    label: string;
    url: string;
    embedUrl?: string;
    kind: 'commons' | 'youtube' | 'archive' | 'direct';
    prefersIframe: boolean;
    lang?: string;
  };

  const sources = useMemo<SourceOption[]>(() => {
    if (!content) return [];
    const list: SourceOption[] = [];

    if (content.videoUrl) {
      const baseUrl = toCommonsFilePath(content.videoUrl);
      const kind: SourceOption['kind'] = baseUrl.includes('wikimedia.org') ? 'commons' : 'direct';
      list.push({
        key: 'primary',
        label: 'Sorgente principale',
        url: baseUrl,
        kind,
        prefersIframe: false,
        lang: content.language,
      });
    }

    (content.altVideos || []).forEach((v, idx) => {
      if (v.kind === 'youtube') {
        const ytId = extractYouTubeId(v.url);
        const embedUrl = buildYouTubeEmbed(ytId);
        list.push({
          key: `alt-${idx}-${v.url}`,
          label: v.label || 'YouTube',
          url: v.url,
          embedUrl,
          kind: 'youtube',
          prefersIframe: Boolean(embedUrl),
          lang: v.lang,
        });
        return;
      }
      if (v.kind === 'archive') {
        const archiveId = extractArchiveId(v.url);
        const embedUrl = archiveId ? `https://archive.org/embed/${archiveId}` : undefined;
        list.push({
          key: `alt-${idx}-${v.url}`,
          label: v.label || 'Internet Archive',
          url: v.url,
          embedUrl,
          kind: 'archive',
          prefersIframe: Boolean(embedUrl),
          lang: v.lang,
        });
        return;
      }
      list.push({
        key: `alt-${idx}-${v.url}`,
        label: v.label || 'Commons',
        url: toCommonsFilePath(v.url),
        kind: 'commons',
        prefersIframe: false,
        lang: v.lang,
      });
    });

    return list;
  }, [content]);

  useEffect(() => {
    if (sources.length === 0) {
      setSelectedSourceKey(null);
      return;
    }
    setSelectedSourceKey((prev) => {
      if (prev && sources.some((s) => s.key === prev)) return prev;
      return sources[0].key;
    });
  }, [content?.id, sources]);

  const selectedSource = sources.find((s) => s.key === selectedSourceKey) || sources[0];

  const languageOptions = useMemo(() => {
    const langs = sources.map((s) => s.lang).filter(Boolean) as string[];
    return Array.from(new Set(langs));
  }, [sources]);

  const handleLanguageSelect = (lang: string) => {
    const match = sources.find((s) => s.lang === lang) || sources.find((s) => !s.lang);
    if (match) {
      setSelectedSourceKey(match.key);
      setError(null);
      setIsReady(false);
    }
  };

  const mediaUrl = selectedSource
    ? selectedSource.kind === 'commons' || selectedSource.kind === 'direct'
      ? toCommonsFilePath(selectedSource.url)
      : selectedSource.url
    : '';

  const iframeSrc = selectedSource?.embedUrl || mediaUrl;
  const isIframeSelected = Boolean(selectedSource && selectedSource.prefersIframe && iframeSrc);
  const videoSource = mediaUrl;
  const filePathSource = selectedSource && (selectedSource.kind === 'commons' || selectedSource.kind === 'direct')
    ? toCommonsFilePath(videoSource)
    : videoSource;
  const guessMime = (url: string) => {
    if (/\.webm(\?|$)/i.test(url)) return 'video/webm';
    if (/\.mp4(\?|$)/i.test(url)) return 'video/mp4';
    if (/(\.ogv|\.ogg)(\?|$)/i.test(url)) return 'video/ogg';
    if (/\.mkv(\?|$)/i.test(url)) return 'video/x-matroska';
    return undefined;
  };

  const derivedSources: Array<{ src: string; type?: string }> = [];
  if (!isIframeSelected) {
    const addDerived = (src: string) => {
      if (!src) return;
      if (derivedSources.some((s) => s.src === src)) return;
      derivedSources.push({ src, type: guessMime(src) });
    };

    const maybeAddWebmVariant = (url: string) => {
      if (!url) return;
      if (/(\.ogv|\.ogg)(\?|$)/i.test(url)) {
        addDerived(url.replace(/\.(ogv|ogg)(\?|$)/i, '.webm$2'));
      }
    };

    maybeAddWebmVariant(videoSource);
    maybeAddWebmVariant(filePathSource);
  }

  const subtitleTracks: Array<{ src: string; lang?: string; label: string }> = [];
  const addTrack = (src?: string, label?: string, lang?: string) => {
    if (!src) return;
    const normalized = /^blob:|^data:/i.test(src) ? src : toCommonsFilePath(src);
    if (!normalized) return;
    if (subtitleTracks.some((t) => t.src === normalized)) return;
    subtitleTracks.push({ src: normalized, lang, label: label || lang || 'Subtitles' });
  };

  (content?.subtitleTracks || []).forEach((t) => addTrack(t.src, t.label, t.lang));
  if (content?.subtitles && subtitleTracks.length === 0) {
    addTrack(content.subtitles, 'Subtitles');
  }
  if (localSubtitleUrl) {
    addTrack(localSubtitleUrl, localSubtitleLabel || 'Local subtitles', 'en');
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
          {!isIframeSelected && (
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
          )}
        </div>

        {languageOptions.length > 1 && (
          <div className="player-language">
            <label htmlFor="language-select" className="player-language-label">Lingua:</label>
            <select
              id="language-select"
              className="player-language-select"
              value={selectedSource?.lang || languageOptions[0]}
              onChange={(e) => handleLanguageSelect(e.target.value)}
            >
              {languageOptions.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        )}

        {sources.length > 1 && (
          <div className="player-sources">
            <span className="player-sources-label">Sorgenti:</span>
            {sources.map((s) => (
              <button
                key={s.key}
                className={`player-source-button ${selectedSource?.key === s.key ? 'active' : ''}`}
                onClick={() => {
                  setSelectedSourceKey(s.key);
                  setError(null);
                  setIsReady(false);
                }}
              >
                {s.lang ? `${s.label} · ${s.lang}` : s.label}
              </button>
            ))}
          </div>
        )}

        {videoSource ? (
          isIframeSelected ? (
            <div className="player-iframe-wrapper">
              <iframe
                key={`${videoKey}-${selectedSource?.key}`}
                src={iframeSrc}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="player-iframe"
                title={content.title}
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setIsReady(true)}
              />
              {selectedSource?.kind === 'youtube' && (
                <div className="player-fallback" style={{ padding: '0.5rem 0 0' }}>
                  <a
                    href={selectedSource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                    style={{ padding: '0.35rem 0.65rem' }}
                  >
                    Apri su YouTube (se l'embed è bloccato)
                  </a>
                </div>
              )}
            </div>
          ) : (
            <video
              key={`${videoKey}-${selectedSource?.key}`}
              className="player-video"
              controls
              playsInline
              preload="auto"
              poster={content.backdrop || content.poster}
              // Avoid forcing CORS; Commons media often lacks ACAO headers
              referrerPolicy="no-referrer"
              onLoadedData={() => setIsReady(true)}
              onError={() => {
                setError('Impossibile caricare la sorgente selezionata');
                const fallback = sources.find((s) => s.key !== selectedSource?.key);
                if (fallback) setSelectedSourceKey(fallback.key);
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
          )
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

