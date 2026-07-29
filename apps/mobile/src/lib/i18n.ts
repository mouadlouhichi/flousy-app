import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import { messages, type Language, LOCALES, RTL_LOCALES } from '@flousy/core';
import { storage, LANG_STORAGE_KEY } from './storage';

const resources = {
  en: { translation: messages.en },
  fr: { translation: messages.fr },
  ar: { translation: messages.ar },
};

function getInitialLanguage(): Language {
  const saved = storage.getString(LANG_STORAGE_KEY);
  if (saved && LOCALES.includes(saved as Language)) {
    return saved as Language;
  }
  const deviceLang = Localization.getLocales()[0]?.languageCode;
  if (deviceLang && LOCALES.includes(deviceLang as Language)) {
    return deviceLang as Language;
  }
  return 'en';
}

const initialLang = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function setAppLanguage(lang: Language): void {
  storage.set(LANG_STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  const isRtl = RTL_LOCALES.includes(lang);
  if (I18nManager.isRTL !== isRtl) {
    I18nManager.forceRTL(isRtl);
  }
}

export default i18n;
