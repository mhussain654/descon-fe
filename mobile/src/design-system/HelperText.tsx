import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from './tokens';

export interface HelperTextProps {
  children: string;
}

/** Neutral guidance text under a field. */
export function HelperText({ children }: HelperTextProps) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { marginTop: spacing[1.5], fontSize: 14, color: colors.text.secondary },
});
