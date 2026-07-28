'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, TRANSLATIONS, TranslationDictionary } from './translations';
import { useAuth } from './auth-context';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfileData } = useAuth();
  const [language, setLanguageState] = useState<Language>(
    (profile?.language as Language) || 'en'
  );

  useEffect(() => {
    if (profile?.language) {
      setLanguageState(profile.language as Language);
    }
  }, [profile?.language]);

  useEffect(() => {
    const isRtlLang = language === 'ar';
    document.documentElement.dir = isRtlLang ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    updateProfileData({ language: lang }).catch((e) => console.error(e));
  };

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const isRTL = language === 'ar';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
