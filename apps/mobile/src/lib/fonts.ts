import { useFonts } from 'expo-font';

export const FONT = {
  regular: 'InstrumentSans-400',
  medium: 'InstrumentSans-500',
  semibold: 'InstrumentSans-600',
  bold: 'InstrumentSans-700',
  display: 'InstrumentSerif-400',
} as const;

export function useAppFonts() {
  return useFonts({
    [FONT.regular]: require('../../assets/fonts/InstrumentSans_400Regular.ttf'),
    [FONT.medium]: require('../../assets/fonts/InstrumentSans_500Medium.ttf'),
    [FONT.semibold]: require('../../assets/fonts/InstrumentSans_600SemiBold.ttf'),
    [FONT.bold]: require('../../assets/fonts/InstrumentSans_700Bold.ttf'),
    [FONT.display]: require('../../assets/fonts/InstrumentSerif_400Regular.ttf'),
  });
}
