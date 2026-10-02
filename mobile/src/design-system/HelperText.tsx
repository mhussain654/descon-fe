import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from './tokens';
import { getFontFamily } from './fonts';

export interface HelperTextProps {
  children: string;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Neutral guidance text under a field. */
export function HelperText({ children, language = 'en' }: HelperTextProps) {
  return <Text style={[styles.text, { fontFamily: getFontFamily(language, 'regular') }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { marginTop: spacing[1.5], fontSize: 14, color: colors.text.secondary },
});
