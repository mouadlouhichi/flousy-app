import { useFonts } from 'expo-font';
import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';

/**
 * Same faces as web:
 * - Instrument Sans ← apps/web/src/app/fonts/instrument-sans-latin{,-ext}-wght-normal.woff2
 *   (next/font/local, variable wght 400–700), instantiated to static TTFs.
 * - JetBrains Mono ← @fontsource-variable/jetbrains-mono (web layout import),
 *   latin + latin-ext, instantiated at 400/500/700.
 * RN/Android cannot load those WOFF2 variable files, so we ship TTF instances
 * of the exact same outlines under per-weight family names.
 */
export const FONT = {
  regular: 'InstrumentSans-400',
  medium: 'InstrumentSans-500',
  semibold: 'InstrumentSans-600',
  bold: 'InstrumentSans-700',
  display: 'InstrumentSans-700',
  mono: 'JetBrainsMono-400',
  monoMedium: 'JetBrainsMono-500',
  monoBold: 'JetBrainsMono-700',
} as const;

export function useAppFonts() {
  return useFonts({
    [FONT.regular]: require('../../assets/fonts/InstrumentSans_400Regular.ttf'),
    [FONT.medium]: require('../../assets/fonts/InstrumentSans_500Medium.ttf'),
    [FONT.semibold]: require('../../assets/fonts/InstrumentSans_600SemiBold.ttf'),
    [FONT.bold]: require('../../assets/fonts/InstrumentSans_700Bold.ttf'),
    [FONT.mono]: require('../../assets/fonts/JetBrainsMono_400Regular.ttf'),
    [FONT.monoMedium]: require('../../assets/fonts/JetBrainsMono_500Medium.ttf'),
    [FONT.monoBold]: require('../../assets/fonts/JetBrainsMono_700Bold.ttf'),
  });
}

function isMono(family?: string) {
  return !!family && (family.includes('JetBrains') || family.includes('Mono'));
}

function familyForWeight(weight: unknown, current?: string) {
  if (current === FONT.display) return FONT.display;
  const w = String(weight ?? '');
  const bold = w === '700' || w === 'bold' || w === '800' || w === '900';
  if (isMono(current)) {
    if (bold) return FONT.monoBold;
    if (w === '500' || w === '600') return FONT.monoMedium;
    return current && current.startsWith('JetBrains') ? current : FONT.mono;
  }
  if (w === '500') return FONT.medium;
  if (w === '600') return FONT.semibold;
  if (bold) return FONT.bold;
  if (current && String(current).startsWith('InstrumentSans')) return current;
  return FONT.regular;
}

function remapStyle(style: TextStyle | TextStyle[] | undefined) {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  return [
    style,
    {
      fontFamily: familyForWeight(flat.fontWeight, flat.fontFamily as string | undefined),
      fontWeight: '400' as const,
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
    },
  ];
}

function patchForwardRef(Comp: { render?: (props: object, ref: unknown) => unknown } & { __sjFont?: boolean }) {
  if (Comp.__sjFont) return;
  const inner = Comp.render;
  if (typeof inner !== 'function') return;
  Comp.__sjFont = true;
  Comp.render = function patched(props: { style?: TextStyle }, ref: unknown) {
    return inner({ ...props, style: remapStyle(props?.style) }, ref);
  };
}

export function installFontPatch() {
  patchForwardRef(Text as never);
  patchForwardRef(TextInput as never);
}
