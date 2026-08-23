import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, fontWeights, spacing } from './tokens';

export interface StatePanelProps {
  icon?: ReactNode;
  /** Already-translated heading. */
  title?: string;
  /** Already-translated supporting text. */
  description?: string;
  /** Already-translated action button label. Omit to hide the action. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared layout for full-section states (empty/error/offline/forbidden/
 * session-expired). Not exported on its own -- each state below fixes an
 * icon and semantics appropriate to it.
 */
export function StatePanel({ icon, title, description, actionLabel, onAction }: StatePanelProps) {
  return (
    <View style={styles.container}>
      {icon}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button variant="primary" size="sm" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[6], paddingVertical: spacing[12] },
  title: { fontSize: 16, fontWeight: fontWeights.semibold, color: colors.text.primary, textAlign: 'center' },
  description: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing[1] },
});
