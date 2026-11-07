import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../../design-system/Text';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MeasuredSvg } from '../../../design-system/MeasuredSvg';
import { getFontFamily } from '../../../design-system';
import { colors } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from './GradientIconBox';
import { themed, themedStyles, themedValues } from '../../../design-system/theme';

// Soft two-tone diagonal wash per tile (light → a touch deeper), plus the
// matching chevron colour -- from the approved home design.
const TONE_SURFACES: Record<IconTone, { from: string; to: string; border: string; chevron: string }> = themedValues(() => ({
  blue: { from: themed('#EAF6FF', '#132533'), to: themed('#C9E8FF', '#182F40'), border: themed('#BFE0FB', '#334155'), chevron: themed('#086CD8', '#7FBAFA') },
  green: { from: themed('#EAFBF1', '#12311F'), to: themed('#C6F0D7', '#183E27'), border: themed('#B7E8CA', '#334155'), chevron: themed('#087C50', '#82F7CB') },
  purple: { from: themed('#F5F0FF', '#1F1434'), to: themed('#E0D3FF', '#291B48'), border: themed('#D6C7FA', '#334155'), chevron: themed('#6430CE', '#BBA4EA') },
  coral: { from: themed('#FFF3EE', '#321C13'), to: themed('#FFD7CA', '#44241A'), border: themed('#F9C7B7', '#334155'), chevron: themed('#D94331', '#EA998F') },
  orange: { from: themed('#FFF7E8', '#302612'), to: themed('#FFE3B8', '#3E2F18'), border: themed('#F8D49A', '#334155'), chevron: themed('#C36A00', '#FFC27A') },
}));

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
        {
          // Keep the native surface opaque while the measured SVG paints its gradient.
          backgroundColor: surface.from,
          borderColor: surface.border,
          flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left'),
        },
        disabled ? styles.disabled : pressed ? styles.pressed : null,
      ]}
    >
      <MeasuredSvg>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={surface.from} />
            <Stop offset="1" stopColor={surface.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </MeasuredSvg>
      <GradientIconBox tone={tone} icon={icon} size={38} />
      <View style={styles.copy}>
        <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'semibold') }]}>{title}</Text>
        <Text style={[styles.subtitle, isUrdu && styles.subtitleUrdu, { fontFamily: getFontFamily(language, 'regular') }]}>
          {subtitle}
        </Text>
      </View>
      {/* Own layer so the bare SVG icon paints above the gradient. */}
      <View style={styles.chevron}>
        <Chevron size={14} color={surface.chevron} strokeWidth={2.8} />
      </View>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
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
  subtitle: { marginTop: 2, fontSize: 10.5, lineHeight: 13, color: themed('#536177', '#94A3B8') },
  subtitleUrdu: { fontSize: 11, lineHeight: 22 },
  chevron: { position: 'relative', zIndex: 1 },
}));
