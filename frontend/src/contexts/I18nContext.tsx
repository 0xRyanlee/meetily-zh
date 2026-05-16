'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Locale, TranslationKey, translations } from '@/lib/i18n/translations';

interface I18nContextType {
  locale: Locale;
  t: (key: TranslationKey) => string;
  toggleLocale: () => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'meetily_locale';

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === 'zh-TW' || saved === 'en') return saved;
  }
  return 'zh-TW'; // default to Traditional Chinese
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  const t = useCallback(
    (key: TranslationKey): string => translations[locale][key] ?? translations['en'][key] ?? key,
    [locale]
  );

  const toggleLocale = useCallback(() => {
    setLocale(prev => {
      const next: Locale = prev === 'zh-TW' ? 'en' : 'zh-TW';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, toggleLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
