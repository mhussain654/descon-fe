import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontWeights, radii, spacing } from './tokens';

export interface CardProps {
  children: ReactNode;
  /** Removes the default padding, for callers that need edge-to-edge content (e.g. a list). */
  noPadding?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Surface container matching the approved prototype's card pattern (rounded, bordered, white). */
export function Card({ children, noPadding = false, style }: CardProps) {
  return <View style={[styles.card, !noPadding && styles.padded, style]}>{children}</View>;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <View style={styles.header}>{children}</View>;
}

export function CardTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardDescription({ children }: { children: string }) {
  return <Text style={styles.description}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.raised,
  },
  padded: { padding: spacing[6] },
  header: { marginBottom: spacing[4] },
  title: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.text.primary },
  description: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary },
});
