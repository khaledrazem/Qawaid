/**
 * Translation hook — v1-6: language switch (ar / en).
 *
 * Resolves dot-path keys from the current locale's strings.
 * Depends on LanguageProvider for locale state.
 */

import { useLanguage } from '@/contexts/LanguageContext';
import ar from '@/i18n/ar.json';
import en from '@/i18n/en.json';
import type { Locale } from '@/contexts/LanguageContext';

const catalogs: Record<Locale, Record<string, unknown>> = { ar, en };

function resolve(key: string, strings: Record<string, unknown>): string {
  const parts = key.split('.');
  let current: unknown = strings;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}

/**
 * Returns a translation function for the current locale.
 * Re-renders when locale changes (via LanguageContext).
 */
export function useTranslation() {
  const { locale } = useLanguage();
  const strings = catalogs[locale];

  function t(key: string): string {
    return resolve(key, strings);
  }

  return { t };
}
