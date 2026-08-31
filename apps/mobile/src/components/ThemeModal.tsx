import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
} from 'react-native';
import { Sheet } from './Sheet';
import { useColorScheme } from 'nativewind';
import { storage } from '../lib/storage';

interface ThemeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const THEME_STORAGE_KEY = 'flousy_theme';

export function ThemeModal({ visible, onClose }: ThemeModalProps) {
  const { colorScheme, setColorScheme } = useColorScheme();

  const handleSelect = (scheme: 'light' | 'dark' | 'system') => {
    setColorScheme(scheme);
    storage.set(THEME_STORAGE_KEY, scheme);
    onClose();
  };

  const currentScheme = colorScheme || 'system';

  return (
    <Sheet visible={visible} onClose={onClose}>
        <View className="bg-white dark:bg-neutral-900 rounded-t-3xl p-6">
          <View className="flex-row justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4 mb-4">
            <Text className="text-xl font-bold text-neutral-900 dark:text-white">
              Appearance Theme
            </Text>
            <Pressable onPress={onClose}>
              <Text className="text-neutral-500 font-bold text-base">Close</Text>
            </Pressable>
          </View>

          <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            SmartJib uses CSS-variable design tokens for seamless light and dark mode styling.
          </Text>

          <View className="space-y-3">
            {(
              [
                { id: 'light', label: 'Light Theme', desc: 'Clean bright interface' },
                { id: 'dark', label: 'Dark Theme', desc: 'Easy on the eyes in low light' },
                { id: 'system', label: 'System Default', desc: 'Follow device appearance setting' },
              ] as const
            ).map((item) => {
              const active = currentScheme === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelect(item.id)}
                  className={`p-4 rounded-2xl border flex-row justify-between items-center ${
                    active
                      ? 'bg-primary/10 border-primary'
                      : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  <View>
                    <Text className="font-bold text-base text-neutral-900 dark:text-white">
                      {item.label}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {item.desc}
                    </Text>
                  </View>

                  {active && (
                    <View className="bg-primary px-3 py-1 rounded-full">
                      <Text className="text-xs text-white font-bold">Selected</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
    </Sheet>
  );
}
