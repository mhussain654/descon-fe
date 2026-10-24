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

/**
 * Below this size Nastaliq's thin marks run together (a bold 13 reads "مکمل" as "ململ"), so smaller
 * Urdu text is raised to it.
 */
export const NASTALIQ_MIN_FONT_SIZE = 14;

/**
 * Nastaliq's ink spills outside its line box: strokes overhang the end of a line, and dots and tails
 * hang well below the baseline. Android clips ink that falls outside the text view, so the view gets
 * padding to draw into. A style that already pads a side is left alone.
 */
const NASTALIQ_OVERHANG_RATIO = 0.4;
const NASTALIQ_MIN_OVERHANG = 6;
const NASTALIQ_BELOW_RATIO = 0.35;
const NASTALIQ_ABOVE_RATIO = 0.1;
const SIDE_PADDING_KEYS = ['padding', 'paddingHorizontal', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd'] as const;
const BOTTOM_PADDING_KEYS = ['padding', 'paddingVertical', 'paddingBottom'] as const;
const TOP_PADDING_KEYS = ['padding', 'paddingVertical', 'paddingTop'] as const;

const isSet = (style: TextStyle, keys: readonly (keyof TextStyle)[]) => keys.some((key) => style[key] !== undefined);

export function nastaliqFontSize(fontSize: number | undefined): number {
  return Math.max(fontSize ?? DEFAULT_FONT_SIZE, NASTALIQ_MIN_FONT_SIZE);
}

export function nastaliqLineHeight(fontSize: number | undefined, lineHeight: number | undefined): number | undefined {
  const minimum = Math.round((fontSize ?? DEFAULT_FONT_SIZE) * NASTALIQ_LINE_HEIGHT_RATIO);
  return (lineHeight ?? 0) >= minimum ? undefined : minimum;
}

/** The padding Urdu text needs around its ink, for whichever sides the style leaves unpadded. */
export function nastaliqPadding(fontSize: number, style: TextStyle): TextStyle {
  return {
    ...(isSet(style, SIDE_PADDING_KEYS) ? null : { paddingHorizontal: Math.max(NASTALIQ_MIN_OVERHANG, Math.round(fontSize * NASTALIQ_OVERHANG_RATIO)) }),
    ...(isSet(style, BOTTOM_PADDING_KEYS) ? null : { paddingBottom: Math.round(fontSize * NASTALIQ_BELOW_RATIO) }),
    ...(isSet(style, TOP_PADDING_KEYS) ? null : { paddingTop: Math.round(fontSize * NASTALIQ_ABOVE_RATIO) }),
  };
}

/**
 * Drop-in replacement for react-native's Text. Any text rendered in the Nastaliq family
 * automatically gets a legible size, a line height, room for its ink and a safe line-break mode,
 * so no screen has to remember to set them.
 * Use this instead of importing Text from 'react-native' (enforced by textImportGuard.test.ts).
 */
export function Text({ style, ...props }: TextProps) {
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  const isNastaliq = typeof flat.fontFamily === 'string' && flat.fontFamily.startsWith(NASTALIQ_FAMILY_PREFIX);
  if (!isNastaliq) return <NativeText {...props} style={style} />;

  const fontSize = nastaliqFontSize(flat.fontSize);
  const lineHeight = nastaliqLineHeight(fontSize, flat.lineHeight);
  const adjustments: TextStyle = {
    ...(fontSize !== flat.fontSize ? { fontSize } : null),
    ...(lineHeight ? { lineHeight } : null),
    ...nastaliqPadding(fontSize, flat),
  };
  // 'simple' breaks lines without re-measuring, which stops Android wrapping the last word of a
  // content-sized Nastaliq text onto a hidden second line (the "میرا سفر" shown as "میرا" bug).
  return <NativeText textBreakStrategy="simple" {...props} style={[style, adjustments]} />;
}
