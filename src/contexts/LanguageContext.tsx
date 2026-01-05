import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'hi'
  | 'bn'
  | 'tr'
  | 'nl'
  | 'sv'
  | 'pl'
  | 'uk'
  | 'cs'
  | 'ro'
  | 'el'
  | 'he'
  | 'id'
  | 'vi'
  | 'th'
  | 'fa'
  // EU official languages not already listed
  | 'bg'
  | 'hr'
  | 'da'
  | 'et'
  | 'fi'
  | 'hu'
  | 'ga'
  | 'lv'
  | 'lt'
  | 'mt'
  | 'sk'
  | 'sl';

export type LanguageOption = { code: LanguageCode; label: string; native?: string };

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'tr', label: 'Turkish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'sv', label: 'Swedish' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'cs', label: 'Czech' },
  { code: 'ro', label: 'Romanian' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'id', label: 'Indonesian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'fa', label: 'Persian' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'hr', label: 'Croatian' },
  { code: 'da', label: 'Danish' },
  { code: 'et', label: 'Estonian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'ga', label: 'Irish' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mt', label: 'Maltese' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovene' },
];

const FALLBACK_CHAIN: LanguageCode[] = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
  'ar',
  'hi',
  'bn',
  'tr',
  'nl',
  'sv',
  'pl',
  'uk',
  'cs',
  'ro',
  'el',
  'he',
  'id',
  'vi',
  'th',
  'fa',
  'bg',
  'hr',
  'da',
  'et',
  'fi',
  'hu',
  'ga',
  'lv',
  'lt',
  'mt',
  'sk',
  'sl',
];

interface LanguageContextValue {
  preferredLang: LanguageCode;
  setPreferredLang: (code: LanguageCode) => void;
  supported: LanguageOption[];
  fallbacks: LanguageCode[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = 'wikiflix-lang';

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [preferredLang, setPreferredLangState] = useState<LanguageCode>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
        setPreferredLangState(stored as LanguageCode);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const setPreferredLang = (code: LanguageCode) => {
    setPreferredLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
      // ignore storage failures
    }
  };

  const value = useMemo(
    () => ({ preferredLang, setPreferredLang, supported: SUPPORTED_LANGUAGES, fallbacks: FALLBACK_CHAIN }),
    [preferredLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};

export const getLanguageHostCandidates = (
  baseHost: string | undefined,
  preferred: LanguageCode,
  fallbacks: LanguageCode[]
): string[] => {
  const candidates: string[] = [];
  const preferredHost = `${preferred}.wikipedia.org`;
  if (preferredHost) candidates.push(preferredHost);
  if (baseHost) candidates.push(baseHost);
  fallbacks.forEach((code) => {
    const h = `${code}.wikipedia.org`;
    if (h) candidates.push(h);
  });
  const seen = new Set<string>();
  return candidates.filter((h) => {
    if (seen.has(h)) return false;
    seen.add(h);
    return true;
  });
};

export const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES;
export const LANGUAGE_FALLBACKS = FALLBACK_CHAIN;
