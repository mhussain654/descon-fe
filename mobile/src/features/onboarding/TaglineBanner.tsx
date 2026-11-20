import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../design-system/Text';
import { INTER_BOLD_ITALIC, getFontFamily } from '../../design-system';
import { spacing } from '../../design-system/tokens';
import { isStartSide } from '../../lib/layoutDirection';

// Descon brand red and navy. The banner sits on the hero artwork, which is the
// same in both themes, so these stay fixed rather than following the theme.
const DESCON_RED = '#E31E24';
const BANNER_NAVY = '#0B2D6B';
const SHADOW = 'rgba(0, 30, 90, 0.28)';
// How far the card's ends slant from upright.
const LEAN_DEGREES = 14;
const CORNER_RADIUS = 12;
// The red band is turned this much behind the card, so it peeks out above it
// on the reading side and below it at the far end.
const BAND_TURN = '4deg';
// The banner was designed on a 360-point-wide phone. The hero artwork always
// fills the screen width, so the banner scales with it too: that keeps the same
// gap to the globe on every phone, instead of crowding it on a narrow screen
// or floating far from it on a wide one. Capped so a tablet's banner does not
// grow past half again its size.
const DESIGN_WIDTH = 360;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.5;

/** How much to scale the banner for a screen of the given width. */
export function taglineScale(screenWidth: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, screenWidth / DESIGN_WIDTH));
}

type Point = [number, number];

/**
 * A parallelogram with straight top and bottom edges and ends that lean
 * toward `side`, with rounded corners, as an SVG path. Drawn rather than made
 * with a skew transform because Android ignores skew on views.
 */
export function slantedCardPath(width: number, height: number, side: 'left' | 'right'): string {
  const lean = height * Math.tan((LEAN_DEGREES * Math.PI) / 180);
  // Clockwise from the top-left corner.
  const corners: Point[] =
    side === 'left'
      ? [[lean, 0], [width, 0], [width - lean, height], [0, height]]
      : [[0, 0], [width - lean, 0], [width, height], [lean, height]];
  const radius = Math.min(CORNER_RADIUS, height / 3);
  const toward = ([x1, y1]: Point, [x2, y2]: Point): Point => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    return [x1 + ((x2 - x1) / length) * radius, y1 + ((y2 - y1) / length) * radius];
  };
  const round = (value: number) => Math.round(value * 10) / 10;
  const segments = corners.map((corner, index) => {
    const previous = corners[(index + corners.length - 1) % corners.length];
    const next = corners[(index + 1) % corners.length];
    const [ax, ay] = toward(corner, previous);
    const [bx, by] = toward(corner, next);
    return `${index === 0 ? 'M' : 'L'}${round(ax)},${round(ay)} Q${round(corner[0])},${round(corner[1])} ${round(bx)},${round(by)}`;
  });
  return `${segments.join(' ')} Z`;
}

interface TaglineBannerProps {
  /** Already-translated tagline; a line break in it sets where the two lines split. */
  text: string;
  /** 'ur' sets it upright in Nastaliq; anything else in Inter Bold Italic. */
  language: string;
  /** The physical side the banner hangs from: left for English, right for Urdu. */
  side: 'left' | 'right';
}

/**
 * The Welcome page tagline as a banner (client-approved "Option A", Nov 2026):
 * a white card with straight top and bottom edges and slanted ends, leaning
 * toward the reading direction, with a Descon-red band of the same shape
 * turned a few degrees behind it. Mirrors for Urdu.
 */
export function TaglineBanner({ text, language, side }: TaglineBannerProps) {
  const isUrdu = language === 'ur';
  const fromLeft = side === 'left';
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const scale = taglineScale(useWindowDimensions().width);
  const scaled = (value: number) => Math.round(value * scale);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => (current?.width === width && current?.height === height ? current : { width, height }));
  };
  const path = size ? slantedCardPath(size.width, size.height, side) : null;

  return (
    <View
      testID="tagline-banner"
      style={[
        { marginTop: scaled(spacing[4]) },
        fromLeft ? { marginLeft: -scaled(10) } : { marginRight: -scaled(10) },
        isStartSide(side) ? styles.alignStart : styles.alignEnd,
      ]}
    >
      <View
        testID="tagline-banner-band"
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: fromLeft ? BAND_TURN : `-${BAND_TURN}` }] }]}
      >
        {path && size ? (
          <Svg width={size.width} height={size.height}>
            <Path d={path} fill={DESCON_RED} />
          </Svg>
        ) : null}
      </View>
      {path && size ? (
        <Svg pointerEvents="none" style={[styles.shadow, { top: scaled(5) }]} width={size.width} height={size.height}>
          <Path d={path} fill={SHADOW} />
        </Svg>
      ) : null}
      {path && size ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
          <Path d={path} fill="#FFFFFF" />
        </Svg>
      ) : null}
      <View testID="tagline-banner-card" style={{ paddingVertical: scaled(7), paddingHorizontal: scaled(20) }} onLayout={onLayout}>
        {/* The phone's font-size setting is not applied: the banner keeps its
            proportion to the artwork, which is what keeps it off the globe. */}
        <Text
          maxFontSizeMultiplier={1}
          style={[
            styles.text,
            // Nastaliq needs about twice the line height.
            isUrdu ? { fontSize: scaled(16), lineHeight: scaled(34) } : { fontSize: scaled(15), lineHeight: scaled(19) },
            { fontFamily: isUrdu ? getFontFamily(language, 'bold') : INTER_BOLD_ITALIC, writingDirection: isUrdu ? 'rtl' : 'ltr' },
          ]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Flex alignment flips in an RTL layout (Urdu on Android and iOS), so it is
  // picked from the physical side.
  alignStart: { alignSelf: 'flex-start' },
  alignEnd: { alignSelf: 'flex-end' },
  // A soft drop shadow under the card (SVG shapes take no native shadow).
  shadow: { position: 'absolute', left: 0 },
  text: { textAlign: 'center', color: BANNER_NAVY },
});
