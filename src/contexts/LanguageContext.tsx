/**
 * LanguageContext — v1-6
 *
 * Provides current locale ('ar' | 'en') and setLocale. Persists to localStorage (sahra_lang).
 * Wrap the app in LanguageProvider so useTranslation can switch languages.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'sahra_lang';
export type Locale = 'ar' | 'en';

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'ar' || raw === 'en') return raw;
  } catch { /* ignore */ }
  return 'ar';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch { /* ignore */ }
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale === 'ar' ? 'ar' : 'en';
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
