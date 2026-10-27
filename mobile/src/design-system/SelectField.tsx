import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { Text } from './Text';
import { Button } from './Button';
import { ValidationMessage } from './ValidationMessage';
import { colors, radii, spacing, zIndex } from './tokens';
import { getFontFamily } from './fonts';
import { physicalTextAlign, rowDirectionTowards } from '../lib/layoutDirection';

export interface SelectFieldOption {
  value: string;
  /** Already-translated option label. */
  label: string;
}

export interface SelectFieldProps {
  /** Already-translated label text. */
  label: string;
  /** The selected option's value, or '' when nothing is chosen yet. */
  value: string;
  options: SelectFieldOption[];
  onChange: (value: string) => void;
  /** Already-translated text shown while nothing is chosen. */
  placeholder: string;
  /** Already-translated label for the button that closes the list without choosing. */
  cancelLabel: string;
  /** Already-translated neutral guidance shown when there's no error. */
  helperText?: string;
  /** Already-translated validation message. When set, the field is styled as invalid. */
  errorMessage?: string;
  /** Which font family renders the text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Closed-list picker: a field that opens a modal sheet of options (React Native has no native <select>). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  cancelLabel,
  helperText,
  errorMessage,
  language = 'en',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const hasError = Boolean(errorMessage);
  const selected = options.find((option) => option.value === value);
  const side = language === 'ur' ? 'right' : 'left';
  const textStyle = { textAlign: physicalTextAlign(side), fontFamily: getFontFamily(language, 'regular') };

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View>
      <Label language={language}>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        style={[styles.trigger, { flexDirection: rowDirectionTowards(side), borderColor: hasError ? colors.danger.default : colors.border.default }]}
      >
        <Text style={[styles.triggerText, textStyle, { color: selected ? colors.text.primary : colors.text.tertiary }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={20} color={colors.text.tertiary} />
      </Pressable>
      {errorMessage ? (
        <ValidationMessage tone="error" language={language}>
          {errorMessage}
        </ValidationMessage>
      ) : helperText ? (
        <HelperText language={language}>{helperText}</HelperText>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} accessibilityViewIsModal>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityRole="none" importantForAccessibility="no" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={[styles.sheetTitle, { fontFamily: getFontFamily(language, 'semibold'), textAlign: physicalTextAlign(side) }]}>{label}</Text>
          <ScrollView style={styles.list}>
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.option, { flexDirection: rowDirectionTowards(side) }]}
                >
                  <Text style={[styles.optionText, textStyle, isSelected && { color: colors.brand.default }]}>{option.label}</Text>
                  {isSelected ? <Check size={18} color={colors.brand.default} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Button variant="outline" onPress={() => setOpen(false)} language={language}>
            {cancelLabel}
          </Button>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.raised,
  },
  triggerText: { flex: 1, fontSize: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface.overlay, zIndex: zIndex.overlay },
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    maxHeight: '75%',
    borderTopStartRadius: radii.xl,
    borderTopEndRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    padding: spacing[4],
    gap: spacing[3],
    zIndex: zIndex.modal,
  },
  sheetTitle: { fontSize: 18, color: colors.text.primary },
  list: { flexGrow: 0 },
  option: { alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], minHeight: 48, paddingVertical: spacing[2] },
  optionText: { flex: 1, fontSize: 16, color: colors.text.primary },
});
