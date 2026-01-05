import { useEffect, useMemo, useState } from 'react';
import { Content } from '@/types';
import { useLanguage, getLanguageHostCandidates } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import './InfoModal.css';

interface InfoModalProps {
  content: Content | null;
  onClose: () => void;
  onPlay: (c: Content) => void;
}

export const InfoModal = ({ content, onClose, onPlay }: InfoModalProps) => {
  if (!content) return null;

  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return undefined;
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
  };

  const backdrop = content.backdrop || content.poster;
  const [richDescription, setRichDescription] = useState<string | null>(null);
  const { preferredLang, fallbacks } = useLanguage();

  const formatExtract = useMemo(() => (text: string | null | undefined) => {
    if (!text) return '';
    let out = text.replace(/==+\s*(.*?)\s*==+/g, '$1\n');
    out = out.replace(/\r/g, '');
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }, []);

  useEffect(() => {
    setRichDescription(null);
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

  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        {backdrop && <div className="info-hero" style={{ backgroundImage: `url(${backdrop})` }} />}
        <button className="info-close" onClick={onClose} aria-label="Close info">×</button>
        <div className="info-body">
          <div className="info-header">
            <div>
              <h2>{content.title}</h2>
              {content.year && <span className="info-pill">{content.year}</span>}
              <span className="info-pill">{content.type === 'movie' ? 'Film' : 'Serie TV'}</span>
              {content.durationSeconds && <span className="info-pill">{formatDuration(content.durationSeconds)}</span>}
              {content.language && <span className="info-pill">Lang: {content.language}</span>}
            </div>
            <div className="info-actions">
              <button className="btn btn-primary" onClick={() => { onPlay(content); onClose(); }}>
                ▶ Guarda
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Chiudi</button>
            </div>
          </div>

          {(richDescription || content.descriptionLong || content.description) && (
            <p className="info-description long">
              {formatExtract(richDescription || content.descriptionLong || content.description)}
            </p>
          )}

          <div className="info-meta-grid">
            {content.license && (
              <div className="info-meta">
                <div className="info-meta-label">Licenza</div>
                <div className="info-meta-value">{content.license}</div>
              </div>
            )}
            {content.commonsLink && (
              <div className="info-meta">
                <div className="info-meta-label">Commons</div>
                <a className="info-meta-link" href={content.commonsLink} target="_blank" rel="noreferrer">Pagina del file</a>
              </div>
            )}
            {content.directors?.length ? (
              <div className="info-meta">
                <div className="info-meta-label">Regia</div>
                <div className="info-meta-value">{content.directors.join(', ')}</div>
              </div>
            ) : null}
            {content.countries?.length ? (
              <div className="info-meta">
                <div className="info-meta-label">Paesi</div>
                <div className="info-meta-value">{content.countries.join(', ')}</div>
              </div>
            ) : null}
            {content.wikidataId && (
              <div className="info-meta">
                <div className="info-meta-label">Wikidata</div>
                <a className="info-meta-link" href={`https://www.wikidata.org/wiki/${content.wikidataId}`} target="_blank" rel="noreferrer">Scheda</a>
              </div>
            )}
            {content.wikipediaUrl && (
              <div className="info-meta">
                <div className="info-meta-label">Wikipedia</div>
                <a className="info-meta-link" href={content.wikipediaUrl} target="_blank" rel="noreferrer">Leggi</a>
              </div>
            )}
            <div className="info-meta lang">
              <div className="info-meta-label">Lingua</div>
              <LanguageSelector size="sm" align="left" label="Lingua preferita" />
            </div>
            {content.subtitles && (
              <div className="info-meta">
                <div className="info-meta-label">Sottotitoli</div>
                <div className="info-meta-value">Pronti</div>
              </div>
            )}
            {content.altVideos?.length ? (
              <div className="info-meta">
                <div className="info-meta-label">Fonti</div>
                <div className="info-meta-value">{content.altVideos.length + 1} totali</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
