'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  type Language,
  type Messages,
  LOCALE_NAMES,
  EN_MESSAGES,
  getIntlLocale,
  isRTL,
  resolveClientLocale,
  setLanguageCookie,
  LANG_STORAGE_KEY,
  LANGUAGE_CHANGE_EVENT,
} from './i18n';
import { loadMessages } from './messages';
import { formatMessage, translateMessage } from './i18n-core';

interface LightLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  messages: Messages;
  t: (template: string, values?: Record<string, string | number>) => string;
  translate: (path: string, values?: Record<string, string | number>) => string;
  isRTL: boolean;
  intlLocale: string;
  localeNames: Record<Language, string>;
}

const LightLanguageContext = createContext<LightLanguageContextType | null>(null);

export function LightLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [messages, setMessages] = useState<Messages>(EN_MESSAGES);
  const messageRequest = useRef(0);

  const applyLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    // Ignore a slower previous locale request after the visitor changes
    // language again, so Arabic never briefly reverts to English.
    const request = ++messageRequest.current;
    loadMessages(nextLanguage)
      .then((nextMessages) => {
        if (request === messageRequest.current) setMessages(nextMessages);
      })
      .catch(() => {
        if (request === messageRequest.current) setMessages(EN_MESSAGES);
      });

    const rtl = isRTL(nextLanguage);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = nextLanguage;

    // The native install dialog reads the linked manifest rather than React
    // copy. Swap it with the UI locale so Arabic and French installations do
    // not surface the English app description or dashboard shortcut.
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const manifestHref = nextLanguage === 'en' ? '/manifest.json' : `/manifest-${nextLanguage}.json`;
    if (manifest && manifest.getAttribute('href') !== manifestHref) {
      manifest.setAttribute('href', manifestHref);
    }
  }, []);

  useEffect(() => {
    applyLanguage(resolveClientLocale());

    // Authenticated app routes mount a full LanguageProvider inside this
    // lightweight public provider. Keep public-shell pieces such as the PWA
    // install prompt in lockstep when a preference changes there.
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<Language>).detail;
      if (nextLanguage === 'en' || nextLanguage === 'fr' || nextLanguage === 'ar') {
        applyLanguage(nextLanguage);
      }
    };
    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
  }, [applyLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageCookie(lang);
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
    applyLanguage(lang);
  }, [applyLanguage]);

  const t = useCallback(
    (template: string, values?: Record<string, string | number>) => formatMessage(template, values, getIntlLocale(language)),
    [language],
  );
  const translate = useCallback(
    (path: string, values?: Record<string, string | number>) => translateMessage(messages, path, values, getIntlLocale(language)),
    [language, messages],
  );

  return (
    <LightLanguageContext.Provider
      value={{ language, setLanguage, messages, t, translate, isRTL: isRTL(language), intlLocale: getIntlLocale(language), localeNames: LOCALE_NAMES }}
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
