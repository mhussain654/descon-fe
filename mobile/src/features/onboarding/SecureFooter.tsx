import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { getFontFamily } from '../../design-system';
import { colors, spacing } from '../../design-system/tokens';

/** Green shield + reassurance line closing the welcome and sign-in sheets. */
export function SecureFooter({ language, children }: { language: string; children: string }) {
  const isUrdu = language === 'ur';
  return (
    <View style={styles.row}>
      <ShieldCheck size={16} color={colors.success.default} strokeWidth={2.5} />
      <Text
        style={[styles.text, isUrdu ? styles.textUrdu : null, { fontFamily: getFontFamily(language, 'regular') }]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  text: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
  // Nastaliq's thin strokes wash out in the standard secondary grey.
  textUrdu: { color: colors.text.primary, opacity: 0.74 },
});
