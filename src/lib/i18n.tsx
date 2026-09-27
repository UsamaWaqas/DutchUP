import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './translations/en';
import fr from './translations/fr';
import de from './translations/de';
import es from './translations/es';
import cs from './translations/cs';
import pt from './translations/pt';
import it from './translations/it';
import hi from './translations/hi';
import tr from './translations/tr';

export type Language = 'en' | 'fr' | 'de' | 'es' | 'cs' | 'pt' | 'it' | 'hi' | 'tr';
export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'cs', label: 'Čeština' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'tr', label: 'Türkçe' },
];

const DICTS: Record<Language, typeof en> = { en, fr, de, es, cs, pt, it, hi, tr };
const STORAGE_KEY = '@dutchup/language';

function lookup(dict: any, path: string): string | undefined {
  return path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), dict);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** `t('groups.title')`, or with a plural count: `t('groups.acrossActiveGroups', { count })`. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && stored in DICTS) setLanguageState(stored as Language);
      setLoaded(true);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  };

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const count = vars?.count;
      let resolveKey = key;
      if (typeof count === 'number') {
        resolveKey = count === 1 ? `${key}_one` : `${key}_other`;
      }
      const dict = DICTS[language];
      const raw = lookup(dict, resolveKey) ?? lookup(dict, key) ?? lookup(en, resolveKey) ?? lookup(en, key) ?? key;
      return interpolate(raw, vars);
    };
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({ language, setLanguage, t }), [language, t]);

  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within a LanguageProvider');
  return ctx;
}
