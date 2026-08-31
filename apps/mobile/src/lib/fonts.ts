import { useFonts } from 'expo-font';
import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';

export const FONT = {
  regular: 'InstrumentSans-400',
  medium: 'InstrumentSans-500',
  semibold: 'InstrumentSans-600',
  bold: 'InstrumentSans-700',
  display: 'InstrumentSerif-400',
} as const;

/** Web dashboard uses Instrument Sans for body and wordmark (variable 400–700). */
export function useAppFonts() {
  return useFonts({
    [FONT.regular]: require('../../assets/fonts/InstrumentSans_400Regular.ttf'),
    [FONT.medium]: require('../../assets/fonts/InstrumentSans_500Medium.ttf'),
    [FONT.semibold]: require('../../assets/fonts/InstrumentSans_600SemiBold.ttf'),
    [FONT.bold]: require('../../assets/fonts/InstrumentSans_700Bold.ttf'),
    [FONT.display]: require('../../assets/fonts/InstrumentSerif_400Regular.ttf'),
  });
}

function familyForWeight(weight: unknown, current?: string) {
  if (current === FONT.display || String(current || '').includes('Serif')) return FONT.display;
  const w = String(weight ?? '');
  if (w === '500') return FONT.medium;
  if (w === '600') return FONT.semibold;
  if (w === '700' || w === 'bold' || w === '800' || w === '900') return FONT.bold;
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

/** Android synthesizes bold on top of *-700 TTFs (glyphs overlap / “hidden”). */
export function installFontPatch() {
  patchForwardRef(Text as never);
  patchForwardRef(TextInput as never);
}
