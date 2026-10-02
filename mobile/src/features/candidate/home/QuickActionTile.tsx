import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getFontFamily } from '../../../design-system';
import { colors } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from './GradientIconBox';

// Soft two-tone diagonal wash per tile (light → a touch deeper), plus the
// matching chevron colour -- from the approved home design.
const TONE_SURFACES: Record<IconTone, { from: string; to: string; border: string; chevron: string }> = {
  blue: { from: '#EAF6FF', to: '#C9E8FF', border: '#BFE0FB', chevron: '#086CD8' },
  green: { from: '#EAFBF1', to: '#C6F0D7', border: '#B7E8CA', chevron: '#087C50' },
  purple: { from: '#F5F0FF', to: '#E0D3FF', border: '#D6C7FA', chevron: '#6430CE' },
  coral: { from: '#FFF3EE', to: '#FFD7CA', border: '#F9C7B7', chevron: '#D94331' },
  orange: { from: '#FFF7E8', to: '#FFE3B8', border: '#F8D49A', chevron: '#C36A00' },
};

interface QuickActionTileProps {
  language: string;
  tone: IconTone;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Two-column home shortcut: gradient-tinted tile, gradient icon, title + hint, and a chevron pointing the reading way. */
export function QuickActionTile({ language, tone, icon, title, subtitle, onPress, disabled }: QuickActionTileProps) {
  const isUrdu = language === 'ur';
  const surface = TONE_SURFACES[tone];
  const Chevron = isUrdu ? ChevronLeft : ChevronRight;
  const gradientId = `quickTile-${tone}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: surface.border, flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') },
        disabled ? styles.disabled : pressed ? styles.pressed : null,
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={surface.from} />
            <Stop offset="1" stopColor={surface.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <GradientIconBox tone={tone} icon={icon} size={38} />
      <View style={styles.copy}>
        <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'semibold') }]}>{title}</Text>
        <Text style={[styles.subtitle, isUrdu && styles.subtitleUrdu, { fontFamily: getFontFamily(language, 'regular') }]}>
          {subtitle}
        </Text>
      </View>
      {/* Own layer so the bare SVG icon paints above the gradient on web. */}
      <View style={styles.chevron}>
        <Chevron size={14} color={surface.chevron} strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 82,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 10,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#1F487E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  copy: { flex: 1 },
  title: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: colors.text.primary },
  titleUrdu: { fontSize: 14, lineHeight: 28 },
  subtitle: { marginTop: 2, fontSize: 10.5, lineHeight: 13, color: '#536177' },
  subtitleUrdu: { fontSize: 11, lineHeight: 22 },
  chevron: { position: 'relative', zIndex: 1 },
});
