import { StyleSheet, TextInput, View } from 'react-native';
import { formatCnic, toCnicDigits } from '../../../shared/cnic';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { colors, radii, spacing } from './tokens';
import { ValidationMessage } from './ValidationMessage';

export interface CnicFieldProps {
  /** Already-translated label, e.g. `t('cnic')`. */
  label?: string;
  requirementText?: string;
  helperText?: string;
  errorMessage?: string;
  /** Already-translated placeholder, e.g. `t('enterCNIC')`. */
  placeholder?: string;
  /** Raw digits only (no dashes) -- the component owns display formatting. */
  value: string;
  onValueChange: (digits: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
}

/**
 * CNIC presentation: numeric-only, auto-grouped as 5-7-1, and forced to
 * left-to-right reading order even inside an Urdu/RTL layout, since a CNIC
 * is a numeral identifier rather than prose.
 */
export function CnicField({
  label,
  requirementText,
  helperText,
  errorMessage,
  placeholder,
  value,
  onValueChange,
  editable,
  autoFocus,
}: CnicFieldProps) {
  const hasError = Boolean(errorMessage);

  return (
    <View>
      {label ? <Label requirementText={requirementText}>{label}</Label> : null}
      <TextInput
        value={formatCnic(value)}
        onChangeText={(text) => onValueChange(toCnicDigits(text))}
        keyboardType="number-pad"
        autoComplete="off"
        maxLength={15}
        editable={editable}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        accessibilityLabel={label}
        // RN has no per-element `dir`; textAlign/writingDirection force LTR
        // digit rendering/caret behavior regardless of the app's global RTL state.
        style={[
          styles.input,
          { borderColor: hasError ? colors.danger.default : colors.border.default, textAlign: 'left', writingDirection: 'ltr' },
        ]}
      />
      {errorMessage ? (
        <ValidationMessage tone="error">{errorMessage}</ValidationMessage>
      ) : helperText ? (
        <HelperText>{helperText}</HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    color: colors.text.primary,
    backgroundColor: colors.surface.raised,
  },
});
