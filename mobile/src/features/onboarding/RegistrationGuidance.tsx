import { Modal, StyleSheet, View } from 'react-native';
import { Text } from '../../design-system/Text';
import { Info } from 'lucide-react-native';
import type { Language } from '../../../../shared/i18n/translations';
import { Button, getFontFamily } from '../../design-system';
import { colors, radii, spacing } from '../../design-system/tokens';
import { physicalTextAlign } from '../../lib/layoutDirection';

interface RegistrationGuidanceProps { open: boolean; onClose: () => void; title: string; description: string; closeLabel: string; language: Language; /** The CNIC the candidate entered, already formatted for display. */ cnic: string; /** Already-translated label for that CNIC. */ cnicLabel: string }

export function RegistrationGuidance({ open, onClose, title, description, closeLabel, language, cnic, cnicLabel }: RegistrationGuidanceProps) {
  const copy = { textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.icon} accessible={false}><Info size={26} color="#9A5700" /></View>
          <Text style={[styles.title, copy, { fontFamily: getFontFamily(language, 'bold') }]}>{title}</Text>
          <View style={styles.cnicBox} accessible accessibilityLabel={`${cnicLabel}: ${cnic}`}>
            <Text style={[styles.cnicLabel, copy, { fontFamily: getFontFamily(language) }]}>{cnicLabel}</Text>
            {/* A CNIC is digits and dashes: always left to right, in the Latin font. */}
            <Text style={[styles.cnicValue, { textAlign: copy.textAlign, fontFamily: getFontFamily('en', 'bold') }]}>{cnic}</Text>
          </View>
          <Text style={[styles.description, copy, { fontFamily: getFontFamily(language) }]}>{description}</Text>
          <Button fullWidth language={language} onPress={onClose}>{closeLabel}</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], backgroundColor: colors.surface.overlay },
  card: { width: '100%', maxWidth: 420, padding: spacing[6], borderRadius: radii.xl, backgroundColor: colors.surface.raised, gap: spacing[4] },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF1D8', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 34, color: colors.text.primary },
  description: { fontSize: 14, lineHeight: 30, color: colors.text.secondary },
  cnicBox: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.lg, backgroundColor: colors.surface.sunken },
  cnicLabel: { fontSize: 13, color: colors.text.secondary },
  cnicValue: { fontSize: 20, lineHeight: 28, letterSpacing: 1, writingDirection: 'ltr', color: colors.text.primary },
});
