import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, type ButtonVariant } from './Button';
import { colors, fontWeights, radii, spacing, zIndex } from './tokens';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  confirmVariant?: ButtonVariant;
  isConfirming?: boolean;
}

/** Composed confirmation dialog for destructive/consequential actions, backed by RN's built-in Modal. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmVariant = 'primary',
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
      accessibilityViewIsModal
    >
      <Pressable
        style={styles.overlay}
        onPress={() => onOpenChange(false)}
        accessibilityRole="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.centerer} pointerEvents="box-none">
        <View style={styles.content} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => onOpenChange(false)} disabled={isConfirming}>
              {cancelLabel}
            </Button>
            <Button variant={confirmVariant} onPress={onConfirm} loading={isConfirming}>
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface.overlay,
    zIndex: zIndex.overlay,
  },
  centerer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6], zIndex: zIndex.modal },
  content: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    padding: spacing[6],
    gap: spacing[4],
  },
  title: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.text.primary },
  description: { fontSize: 14, color: colors.text.secondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});
