import { StyleSheet, Text, View } from 'react-native';
import { Spinner } from './Spinner';
import { colors, spacing } from './tokens';

export interface LoadingStateProps {
  /** Already-translated message, e.g. `t('loading')`. */
  message: string;
}

/** Full-section loading state for a remote-data view. */
export function LoadingState({ message }: LoadingStateProps) {
  return (
    <View style={styles.row}>
      <Spinner size="sm" label={message} />
      <Text style={styles.text} importantForAccessibility="no">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[12] },
  text: { fontSize: 14, color: colors.text.secondary },
});
