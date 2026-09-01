import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banknote, Globe, Palette, CalendarDays } from 'lucide-react-native';
import { LOCALES, LOCALE_NAMES, SUPPORTED_CURRENCIES, formatDayOfMonth, type Language } from '@flousy/core';
import { ProfileSubpage } from '../../components/ProfileSubpage';
import { useMobileStore } from '../../lib/store-context';
import { setAppLanguage } from '../../lib/i18n';
import { useColorScheme } from 'nativewind';
import { storage } from '../../lib/storage';
import { THEME_STORAGE_KEY } from '../../components/ThemeModal';

const TEAL = '#00685f';

export default function PreferencesScreen() {
  const { i18n } = useTranslation();
  const { profile, currency, updateProfile } = useMobileStore();
  const { colorScheme, setColorScheme } = useColorScheme();
  const theme = (profile?.theme || colorScheme || 'system') as 'light' | 'dark' | 'system';

  const setTheme = (next: 'light' | 'dark' | 'system') => {
    setColorScheme(next);
    storage.set(THEME_STORAGE_KEY, next);
    void updateProfile({ theme: next });
  };

  return (
    <ProfileSubpage title="Preferences">
      <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
              <Banknote size={20} color={TEAL} />
            </View>
            <Text className="text-sm font-medium text-neutral-900">Currency</Text>
          </View>
          <View className="flex-row flex-wrap justify-end" style={{ maxWidth: 180 }}>
            {Object.keys(SUPPORTED_CURRENCIES).slice(0, 6).map((code) => {
              const active = code === currency;
              return (
                <Pressable
                  key={code}
                  onPress={() => updateProfile({ currency: code })}
                  className="mb-1 ml-1 rounded-lg px-2 py-1"
                  style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
                >
                  <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-neutral-700'}`}>{code}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-row flex-wrap border-t border-neutral-100 px-4 pb-3">
          {Object.keys(SUPPORTED_CURRENCIES).slice(6).map((code) => {
            const active = code === currency;
            return (
              <Pressable
                key={code}
                onPress={() => updateProfile({ currency: code })}
                className="mb-1 mr-1 rounded-lg px-2 py-1"
                style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
              >
                <Text className={`text-[11px] font-bold ${active ? 'text-white' : 'text-neutral-700'}`}>{code}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between border-t border-neutral-100 p-4">
          <View className="flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
              <Globe size={20} color={TEAL} />
            </View>
            <Text className="text-sm font-medium text-neutral-900">Language</Text>
          </View>
        </View>
        <View className="flex-row gap-2 px-4 pb-4">
          {LOCALES.map((lang) => {
            const active = i18n.language === lang;
            return (
              <Pressable
                key={lang}
                onPress={() => {
                  setAppLanguage(lang);
                  void updateProfile({ language: lang });
                }}
                className="flex-1 items-center rounded-xl py-2.5"
                style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-neutral-800'}`}>
                  {LOCALE_NAMES[lang as Language]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="border-t border-neutral-100 p-4">
          <View className="mb-3 flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
              <Palette size={20} color={TEAL} />
            </View>
            <Text className="text-sm font-medium text-neutral-900">Theme</Text>
          </View>
          <View className="flex-row gap-2">
            {(['light', 'dark', 'system'] as const).map((id) => {
              const active = theme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setTheme(id)}
                  className="flex-1 items-center rounded-xl py-2.5"
                  style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
                >
                  <Text className={`text-xs font-bold capitalize ${active ? 'text-white' : 'text-neutral-700'}`}>{id}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="border-t border-neutral-100 p-4">
          <View className="mb-3 flex-row items-center">
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
              <CalendarDays size={20} color={TEAL} />
            </View>
            <Text className="text-sm font-medium text-neutral-900">Budget month starts</Text>
          </View>
          <Text className="mb-3 text-[11px] text-neutral-500">
            Currently the {formatDayOfMonth(profile?.monthStartDate || 1)}.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[1, 5, 15, 25, 28].map((day) => {
              const active = (profile?.monthStartDate || 1) === day;
              return (
                <Pressable
                  key={day}
                  onPress={() => updateProfile({ monthStartDate: day })}
                  className="rounded-xl px-3 py-2"
                  style={{ backgroundColor: active ? TEAL : '#F3F4F6' }}
                >
                  <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-neutral-700'}`}>
                    {formatDayOfMonth(day)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </ProfileSubpage>
  );
}
