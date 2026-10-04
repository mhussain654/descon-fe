import { Modal, StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import type { Language } from '../../../../shared/i18n/translations';
import { Button, getFontFamily } from '../../design-system';
import { colors, radii, spacing } from '../../design-system/tokens';
import { physicalTextAlign } from '../../lib/layoutDirection';

export function RegistrationGuidance({ open, onClose, title, description, closeLabel, language }: { open: boolean; onClose: () => void; title: string; description: string; closeLabel: string; language: Language }) {
  const copy = { textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={styles.icon} accessible={false}><Info size={26} color="#9A5700" /></View>
          <Text style={[styles.title, copy, { fontFamily: getFontFamily(language, 'bold') }]}>{title}</Text>
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
});
