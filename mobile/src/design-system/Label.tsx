import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeights, spacing } from './tokens';

export interface LabelProps {
  children: string;
  /** Already-translated "Required"/"Optional" marker text, or omit to show neither. */
  requirementText?: string;
}

/** Field label. RN has no `htmlFor`; pair this visually above the field it describes. */
export function Label({ children, requirementText }: LabelProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{children}</Text>
      {requirementText ? <Text style={styles.requirement}> ({requirementText})</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[1.5] },
  label: { fontSize: 14, fontWeight: fontWeights.medium, color: colors.text.primary },
  requirement: { fontSize: 14, color: colors.text.tertiary },
});
