'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  type Language,
  type Messages,
  LOCALE_NAMES,
  EN_MESSAGES,
  getIntlLocale,
  isRTL as checkRTL,
  resolveClientLocale,
  setLanguageCookie,
  LANG_STORAGE_KEY,
} from './i18n';
import { loadMessages } from './messages';
import { formatMessage } from './i18n-core';
import { useAuth } from './auth-context';
import { trackEvent } from './analytics';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  messages: Messages;
  t: (template: string, values?: Record<string, string | number>) => string;
  isRTL: boolean;
  intlLocale: string;
  localeNames: Record<Language, string>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfileData } = useAuth();

  const [language, setLanguageState] = useState<Language>(() => {
    if (profile?.language && (profile.language === 'en' || profile.language === 'fr' || profile.language === 'ar')) {
      return profile.language as Language;
    }
    return resolveClientLocale();
  });
  const [messages, setMessages] = useState<Messages>(EN_MESSAGES);

  useEffect(() => {
    // fr/ar chunks load on demand; en is already bundled.
    loadMessages(language).then(setMessages).catch(() => setMessages(EN_MESSAGES));
  }, [language]);

  useEffect(() => {
    if (profile?.language && (profile.language === 'en' || profile.language === 'fr' || profile.language === 'ar')) {
      setLanguageState(profile.language as Language);
    }
  }, [profile?.language]);

  useEffect(() => {
    const rtl = checkRTL(language);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      setLanguageCookie(lang);
      try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
      updateProfileData({ language: lang }).catch((e) => console.error(e));
      trackEvent('change_language', { language: lang });
    },
    [updateProfileData],
  );

  const t = useCallback(
    (template: string, values?: Record<string, string | number>) => formatMessage(template, values),
    [],
  );

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, messages, t, isRTL: checkRTL(language), intlLocale: getIntlLocale(language), localeNames: LOCALE_NAMES }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
