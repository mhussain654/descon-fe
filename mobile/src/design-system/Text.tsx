import { StyleSheet, Text as NativeText, type TextProps, type TextStyle } from 'react-native';

/** Every Urdu font family in fonts.ts starts with this (see Text.test.tsx, which keeps the two in sync). */
export const NASTALIQ_FAMILY_PREFIX = 'NotoNastaliqUrdu';

/**
 * Nastaliq stacks its marks and descenders far taller than Latin script, so text needs roughly
 * twice its font size as line height or the dots and tails are clipped on Android. Styles that
 * already ask for more (or the same) are left alone.
 */
export const NASTALIQ_LINE_HEIGHT_RATIO = 2;
const DEFAULT_FONT_SIZE = 14; // React Native's default text size

export function nastaliqLineHeight(fontSize: number | undefined, lineHeight: number | undefined): number | undefined {
  const minimum = Math.round((fontSize ?? DEFAULT_FONT_SIZE) * NASTALIQ_LINE_HEIGHT_RATIO);
  return (lineHeight ?? 0) >= minimum ? undefined : minimum;
}

/**
 * Drop-in replacement for react-native's Text. Any text rendered in the Nastaliq family
 * automatically gets a line height large enough for it, so no screen has to remember to set one.
 * Use this instead of importing Text from 'react-native' (enforced by textImportGuard.test.ts).
 */
export function Text({ style, ...props }: TextProps) {
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  const isNastaliq = typeof flat.fontFamily === 'string' && flat.fontFamily.startsWith(NASTALIQ_FAMILY_PREFIX);
  const lineHeight = isNastaliq ? nastaliqLineHeight(flat.fontSize, flat.lineHeight) : undefined;
  return <NativeText {...props} style={lineHeight ? [style, { lineHeight }] : style} />;
}
