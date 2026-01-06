import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Content } from '@/types';
import { useLanguage, getLanguageHostCandidates } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';
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
  const [richDescription, setRichDescription] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { preferredLang, fallbacks } = useLanguage();

  const formatExtract = useCallback((text: string | null | undefined) => {
    if (!text) return '';
    // Strip Wikipedia-style headings and collapse extra blank lines
    let out = text.replace(/==+\s*(.*?)\s*==+/g, '$1\n');
    out = out.replace(/\r/g, '');
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }, []);

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
    setRichDescription(null);
    setIsDescriptionExpanded(false);
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

  useEffect(() => {
    const fetchRichDescription = async () => {
      if (!content?.wikipediaUrl) return;
      const existingLen = content.descriptionLong?.length || content.description?.length || 0;
      if (existingLen > 400) return;
      try {
        const url = new URL(content.wikipediaUrl);
        let titlePath = url.pathname;
        if (titlePath.startsWith('/wiki/')) titlePath = titlePath.slice('/wiki/'.length);
        titlePath = decodeURIComponent(titlePath);
        const baseHost = url.hostname;
        if (!titlePath) return;

        const hosts = getLanguageHostCandidates(baseHost, preferredLang, fallbacks);

        for (const host of hosts) {
          const extractUrl = `https://${host}/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exchars=2600&redirects=1&titles=${encodeURIComponent(titlePath)}&origin=*`;
          const res = await fetch(extractUrl);
          if (res.ok) {
            const json = await res.json();
            const pages = json.query?.pages || {};
            const firstPage = Object.values(pages)[0] as any;
            const extract = firstPage?.extract;
            if (typeof extract === 'string' && extract.trim() && extract.length > existingLen) {
              setRichDescription(extract.trim());
              return;
            }
          }

          const summaryUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(titlePath)}`;
          const res2 = await fetch(summaryUrl);
          if (res2.ok) {
            const json2 = await res2.json();
            const extract2 = json2?.extract;
            if (typeof extract2 === 'string' && extract2.trim() && extract2.length > existingLen) {
              setRichDescription(extract2.trim());
              return;
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };

    fetchRichDescription();
  }, [content, preferredLang, fallbacks]);

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

  const extractVimeoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('vimeo.com')) {
        const parts = u.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && /^\d+$/.test(last)) return last;
      }
    } catch (e) {
      // ignore
    }
    const m = url.match(/vimeo\.com\/(\d+)/);
    return m ? m[1] : null;
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
    kind: 'commons' | 'youtube' | 'archive' | 'direct' | 'libreflix' | 'vimeo';
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
      if (v.kind === 'vimeo') {
        const vimeoId = extractVimeoId(v.url);
        const embedUrl = vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : undefined;
        list.push({
          key: `alt-${idx}-${v.url}`,
          label: v.label || 'Vimeo',
          url: v.url,
          embedUrl,
          kind: 'vimeo',
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
      if (v.kind === 'libreflix') {
        let slug: string | undefined;
        let pathFragment: string | undefined;
        try {
          const parsed = new URL(v.url);
          const parts = parsed.pathname.split('/').filter(Boolean);
          if (parts.length) {
            slug = parts[parts.length - 1];
            pathFragment = parts.join('/'); // e.g. i/nosferatu-1922
          }
        } catch (e) {
          // fallback regex for raw slugs
          const m = v.url.match(/([\w-]+)$/);
          slug = m?.[1];
        }
        const embedUrl = pathFragment && /^(i|assistir)\//i.test(pathFragment)
          ? `https://libreflix.org/${pathFragment}` // use full page, inside iframe
          : slug
            ? `https://libreflix.org/assistir/${slug}`
            : undefined;
        list.push({
          key: `alt-${idx}-${v.url}`,
          label: v.label || 'Libreflix',
          url: v.url,
          embedUrl,
          kind: 'libreflix',
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

  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return undefined;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
  };

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

  const pickDescription = (): string | undefined => {
    const descMap = content.descriptions || {};
    const lang = preferredLang;
    const fallbackOrder = [lang, ...fallbacks];
    for (const code of fallbackOrder) {
      const d = descMap[code];
      if (d) return d;
    }
    return content.descriptionLong || content.description;
  };

  const videoKey = content.id; // Force remount on content change to reset iframe
  const displayDescription = richDescription || pickDescription();
  const formattedDescription = formatExtract(displayDescription);
  const shouldClampDescription = (formattedDescription.length || 0) > 420;

  return (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close player">×</button>
        <div className="player-header">
          <div>
            <h2>{content.title}</h2>
            {formattedDescription && (
              <div className="player-description-block">
                <p className={`player-description long ${shouldClampDescription && !isDescriptionExpanded ? 'collapsed' : ''}`}>
                  {formattedDescription}
                </p>
                {shouldClampDescription && (
                  <button
                    className="player-description-toggle"
                    onClick={() => setIsDescriptionExpanded((v) => !v)}
                  >
                    {isDescriptionExpanded ? 'Mostra meno' : 'Mostra altro'}
                  </button>
                )}
              </div>
            )}
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

        {(content.year || content.language || content.license || content.durationSeconds || content.commonsLink || content.wikidataId || content.wikipediaUrl) && (
          <div className="player-meta-card">
            <div className="player-meta-row">
              {content.year && <span className="player-pill">{content.year}</span>}
              <span className="player-pill">{content.type === 'movie' ? 'Film' : 'Serie TV'}</span>
              {(content.genres || []).map((g) => (
                <span key={g} className="player-pill subtle">{g}</span>
              ))}
              {content.durationSeconds && <span className="player-pill">{formatDuration(content.durationSeconds)}</span>}
              {content.language && <span className="player-pill">Lang: {content.language}</span>}
              {content.directors?.length ? (
                <span className="player-pill">{content.directors.slice(0, 2).join(', ')}</span>
              ) : null}
              {content.countries?.length ? (
                <span className="player-pill subtle">{content.countries.slice(0, 2).join(', ')}</span>
              ) : null}
              {content.isTrailer && <span className="player-pill">Trailer</span>}
              {subtitleTracks.length > 0 && <span className="player-pill subtle">{subtitleTracks.length} sub</span>}
              {sources.length > 1 && <span className="player-pill subtle">{sources.length} fonti</span>}
              {content.license && <span className="player-pill">Licenza: {content.license}</span>}
            </div>
            <div className="player-links-row">
              {content.commonsLink && (
                <a href={content.commonsLink} className="player-link" target="_blank" rel="noreferrer">Pagina Commons</a>
              )}
              {content.wikidataId && (
                <a href={`https://www.wikidata.org/wiki/${content.wikidataId}`} className="player-link" target="_blank" rel="noreferrer">Scheda Wikidata</a>
              )}
              {content.wikipediaUrl && (
                <a href={content.wikipediaUrl} className="player-link" target="_blank" rel="noreferrer">Leggi su Wikipedia</a>
              )}
              <div className="player-lang-inline">
                <LanguageSelector size="sm" align="right" label="Lingua preferita" />
              </div>
            </div>
          </div>
        )}

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

