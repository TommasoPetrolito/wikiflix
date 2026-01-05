import { useEffect, useRef, useState } from 'react';
import { useLanguage, LANGUAGE_OPTIONS } from '@/contexts/LanguageContext';
import './LanguageSelector.css';

interface LanguageSelectorProps {
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
  label?: string;
}

export const LanguageSelector = ({ align = 'right', size = 'md', label }: LanguageSelectorProps) => {
  const { preferredLang, setPreferredLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const current = LANGUAGE_OPTIONS.find((l) => l.code === preferredLang);

  return (
    <div className={`lang-picker ${align === 'left' ? 'align-left' : 'align-right'}`} ref={menuRef}>
      <button
        className={`lang-button ${size === 'sm' ? 'sm' : 'md'}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Seleziona lingua"
        title={label || 'Lingua interfaccia'}
      >
        <span className="lang-icon" aria-hidden>🌐</span>
        <span className="lang-label">{current?.code.toUpperCase() || 'EN'}</span>
      </button>
      {open && (
        <div className="lang-menu">
          {LANGUAGE_OPTIONS.map((l) => (
            <button
              key={l.code}
              className={`lang-menu-item ${l.code === preferredLang ? 'active' : ''}`}
              onClick={() => {
                setPreferredLang(l.code);
                setOpen(false);
              }}
            >
              <span className="lang-menu-code">{l.code.toUpperCase()}</span>
              <span className="lang-menu-label">{l.label}</span>
              {l.native && <span className="lang-menu-native">{l.native}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
