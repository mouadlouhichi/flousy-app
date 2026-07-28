'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  type Language,
  type Messages,
  LOCALE_NAMES,
  getMessages,
  isRTL,
  resolveClientLocale,
  setLanguageCookie,
  LANG_STORAGE_KEY,
} from './i18n';
import { formatMessage, getIntlLocale } from './translations';

interface LightLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  messages: Messages;
  t: (template: string, values?: Record<string, string | number>) => string;
  isRTL: boolean;
  intlLocale: string;
  localeNames: Record<Language, string>;
}

const LightLanguageContext = createContext<LightLanguageContextType | null>(null);

export function LightLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(resolveClientLocale);

  useEffect(() => {
    const rtl = isRTL(language);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setLanguageCookie(lang);
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
  }, []);

  const messages = getMessages(language);
  const t = useCallback(
    (template: string, values?: Record<string, string | number>) => formatMessage(template, values),
    [],
  );

  return (
    <LightLanguageContext.Provider
      value={{ language, setLanguage, messages, t, isRTL: isRTL(language), intlLocale: getIntlLocale(language), localeNames: LOCALE_NAMES }}
    >
      {children}
    </LightLanguageContext.Provider>
  );
}

export function useLightLanguage(): LightLanguageContextType {
  const context = useContext(LightLanguageContext);
  if (!context) throw new Error('useLightLanguage must be used within a LightLanguageProvider');
  return context;
}
