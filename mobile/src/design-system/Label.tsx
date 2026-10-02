import { StyleSheet, Text, View } from 'react-native';
import { colors, fontWeights, spacing } from './tokens';
import { getFontFamily } from './fonts';
import { isStartSide } from '../lib/layoutDirection';

export interface LabelProps {
  children: string;
  /** Already-translated "Required"/"Optional" marker text, or omit to show neither. */
  requirementText?: string;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Field label. RN has no `htmlFor`; pair this visually above the field it describes. */
export function Label({ children, requirementText, language = 'en' }: LabelProps) {
  return (
    // Urdu labels start at the right edge -- resolved against the live layout,
    // which only mirrors on native after the language reload (never on web).
    <View style={[styles.row, isStartSide(language === 'ur' ? 'right' : 'left') ? null : styles.rowReversed]}>
      <Text style={[styles.label, { fontFamily: getFontFamily(language, 'medium') }]}>{children}</Text>
      {requirementText ? (
        <Text style={[styles.requirement, { fontFamily: getFontFamily(language, 'regular') }]}> ({requirementText})</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[1.5] },
  rowReversed: { flexDirection: 'row-reverse' },
  label: { fontSize: 14, fontWeight: fontWeights.medium, color: colors.text.primary },
  requirement: { fontSize: 14, color: colors.text.tertiary },
});
