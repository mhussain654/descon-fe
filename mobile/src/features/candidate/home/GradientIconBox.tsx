import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type IconTone = 'blue' | 'orange' | 'green' | 'purple' | 'coral';

// Two-stop gradients per tone, matching the approved home design.
const TONE_GRADIENTS: Record<IconTone, [string, string]> = {
  blue: ['#18A9FF', '#0870EC'],
  orange: ['#FFB12E', '#FF7900'],
  green: ['#36D878', '#0BAC5F'],
  purple: ['#A365FF', '#6A2EE8'],
  coral: ['#FF7A55', '#EF4E3A'],
};

interface GradientIconBoxProps {
  tone: IconTone;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  size?: number;
}

/** Rounded square with a diagonal tone gradient and a white icon -- the home screen's card/tile icon. */
export function GradientIconBox({ tone, icon: Icon, size = 44 }: GradientIconBoxProps) {
  const [from, to] = TONE_GRADIENTS[tone];
  const gradientId = `iconBox-${tone}`;
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.3 }]} accessible={false}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      {/* Own layer above the absolutely-positioned gradient -- a bare SVG icon
          would otherwise paint underneath it on web. */}
      <View style={styles.iconLayer}>
        <Icon size={size * 0.52} color="#FFFFFF" strokeWidth={2.4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconLayer: { position: 'relative', zIndex: 1 },
  box: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#174E9A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
});
