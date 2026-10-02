import {
  useFonts as useInterFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  useFonts as useNastaliqFonts,
  NotoNastaliqUrdu_400Regular,
  NotoNastaliqUrdu_500Medium,
  NotoNastaliqUrdu_600SemiBold,
  NotoNastaliqUrdu_700Bold,
} from '@expo-google-fonts/noto-nastaliq-urdu';
import type { fontWeights } from '../../../shared/design-tokens';

export type FontWeightToken = keyof typeof fontWeights;

// Urdu renders in Nastaliq script everywhere in this app, English in Inter --
// one family per semantic weight token, for both languages, so no screen or
// component ever hardcodes a Latin-only family that silently falls back to
// whatever font the OS happens to pick for unsupported glyphs (the
// inconsistent per-screen Urdu rendering this replaces).
const FONT_FAMILIES: Record<'en' | 'ur', Record<FontWeightToken, string>> = {
  en: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  ur: {
    regular: 'NotoNastaliqUrdu_400Regular',
    medium: 'NotoNastaliqUrdu_500Medium',
    semibold: 'NotoNastaliqUrdu_600SemiBold',
    bold: 'NotoNastaliqUrdu_700Bold',
  },
};

/** The loaded font family for the active language and a semantic weight token. */
export function getFontFamily(language: string, weight: FontWeightToken = 'regular'): string {
  return FONT_FAMILIES[language === 'ur' ? 'ur' : 'en'][weight];
}

/**
 * Loads every font family this app renders text in, for both supported
 * languages. Call once, at the app root (`_layout.jsx`) -- gate splash-hide
 * on the returned boolean. Both families are loaded up front regardless of
 * the active language so switching language never shows an unstyled flash
 * while the other family loads.
 */
export function useAppFonts(): boolean {
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [nastaliqLoaded] = useNastaliqFonts({
    NotoNastaliqUrdu_400Regular,
    NotoNastaliqUrdu_500Medium,
    NotoNastaliqUrdu_600SemiBold,
    NotoNastaliqUrdu_700Bold,
  });
  return interLoaded && nastaliqLoaded;
}
