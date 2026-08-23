import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeights, radii, spacing } from './tokens';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONE_COLORS: Record<BadgeTone, { background: string; text: string }> = {
  neutral: { background: colors.surface.sunken, text: colors.text.secondary },
  brand: { background: colors.brand.subtle, text: colors.brand.emphasis },
  success: { background: colors.success.subtle, text: colors.success.emphasis },
  warning: { background: colors.warning.subtle, text: colors.warning.emphasis },
  danger: { background: colors.danger.subtle, text: colors.danger.emphasis },
  info: { background: colors.info.subtle, text: colors.info.emphasis },
};

const DEFAULT_ICONS: Record<BadgeTone, typeof Circle> = {
  neutral: Circle,
  brand: Circle,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: string;
  /** Override the tone's default icon, or pass `null` to hide it. Status is never conveyed by color alone, so an icon always ships unless explicitly hidden. */
  icon?: ReactNode | null;
}

/** Status badge. Pairs color with an icon so meaning survives color blindness/grayscale printing. */
export function Badge({ tone = 'neutral', children, icon }: BadgeProps) {
  const { background, text } = TONE_COLORS[tone];
  const DefaultIcon = DEFAULT_ICONS[tone];
  const resolvedIcon = icon === null ? null : (icon ?? <DefaultIcon size={14} color={text} />);

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      {resolvedIcon}
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: spacing[1],
  },
  text: { fontSize: 12, fontWeight: fontWeights.semibold },
});
