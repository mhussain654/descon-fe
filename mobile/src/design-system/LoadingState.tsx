import { StyleSheet, Text, View } from 'react-native';
import { Spinner } from './Spinner';
import { colors, spacing } from './tokens';
import { getFontFamily } from './fonts';

export interface LoadingStateProps {
  /** Already-translated message, e.g. `t('loading')`. */
  message: string;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Full-section loading state for a remote-data view. */
export function LoadingState({ message, language = 'en' }: LoadingStateProps) {
  return (
    <View style={styles.row}>
      <Spinner size="sm" label={message} />
      <Text style={[styles.text, { fontFamily: getFontFamily(language, 'regular') }]} importantForAccessibility="no">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[12] },
  text: { fontSize: 14, color: colors.text.secondary },
});
