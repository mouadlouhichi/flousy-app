'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  notifyLanguageChange,
} from './i18n';
import { loadMessages } from './messages';
import { formatMessage, translateMessage } from './i18n-core';
import { useAuth } from './auth-context';
import { trackEvent } from './analytics';

interface LanguageContextType {
  language: Language;
  /** Change the mounted locale; pass false after an already-persisted profile save. */
  setLanguage: (lang: Language, persist?: boolean) => void;
  messages: Messages;
  t: (template: string, values?: Record<string, string | number>) => string;
  translate: (path: string, values?: Record<string, string | number>) => string;
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
  const messageRequest = useRef(0);

  useEffect(() => {
    // Ignore stale dynamic imports when language changes in quick succession.
    const request = ++messageRequest.current;
    loadMessages(language)
      .then((nextMessages) => {
        if (request === messageRequest.current) setMessages(nextMessages);
      })
      .catch(() => {
        if (request === messageRequest.current) setMessages(EN_MESSAGES);
      });
  }, [language]);

  useEffect(() => {
    if (profile?.language && (profile.language === 'en' || profile.language === 'fr' || profile.language === 'ar')) {
      const nextLanguage = profile.language as Language;
      setLanguageState(nextLanguage);
      setLanguageCookie(nextLanguage);
      try { localStorage.setItem(LANG_STORAGE_KEY, nextLanguage); } catch { /* ignore */ }
      notifyLanguageChange(nextLanguage);
    }
  }, [profile?.language]);

  useEffect(() => {
    const rtl = checkRTL(language);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language, persist = true) => {
      setLanguageState(lang);
      setLanguageCookie(lang);
      notifyLanguageChange(lang);
      try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
      if (persist) {
        updateProfileData({ language: lang }).catch((e) => console.error(e));
        trackEvent('change_language', { language: lang });
      }
    },
    [updateProfileData],
  );

  const t = useCallback(
    (template: string, values?: Record<string, string | number>) => formatMessage(template, values, getIntlLocale(language)),
    [language],
  );
  const translate = useCallback(
    (path: string, values?: Record<string, string | number>) => translateMessage(messages, path, values, getIntlLocale(language)),
    [language, messages],
  );

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, messages, t, translate, isRTL: checkRTL(language), intlLocale: getIntlLocale(language), localeNames: LOCALE_NAMES }}
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
