import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HelperText } from './HelperText';
import { colors, fontWeights, radii, spacing } from './tokens';
import { ValidationMessage } from './ValidationMessage';

const DEFAULT_LENGTH = 6;

export interface OtpFieldProps {
  length?: number;
  value: string;
  onValueChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Already-translated accessible name for the field, e.g. `t('enterOTP')`. */
  label: string;
  helperText?: string;
  errorMessage?: string;
  editable?: boolean;
  autoFocus?: boolean;
}

/**
 * OTP presentation: one real (visually hidden) input driving segmented
 * boxes, for correct mobile keyboard/SMS-autofill behavior. Left-to-right
 * like CnicField -- an OTP is a numeral, not prose.
 */
export function OtpField({
  length = DEFAULT_LENGTH,
  value,
  onValueChange,
  onComplete,
  label,
  helperText,
  errorMessage,
  editable,
  autoFocus,
}: OtpFieldProps) {
  const [isFocused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onValueChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <View>
      <View style={styles.boxRow}>
        {Array.from({ length }).map((_, index) => {
          const char = value[index];
          const isActive = isFocused && value.length === index;
          return (
            <View
              key={index}
              style={[
                styles.box,
                { borderColor: hasError ? colors.danger.default : isActive ? colors.brand.default : colors.border.default },
                isActive && styles.boxActive,
              ]}
            >
              <Text style={styles.char}>{char ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          value={value}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          editable={editable}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          accessibilityState={{ disabled: editable === false }}
          style={styles.hiddenInput}
        />
      </View>
      {errorMessage ? (
        <ValidationMessage tone="error">{errorMessage}</ValidationMessage>
      ) : helperText ? (
        <HelperText>{helperText}</HelperText>
      ) : null}
    </View>
  );
}

const BOX_SIZE = 48;

const styles = StyleSheet.create({
  boxRow: { position: 'relative', flexDirection: 'row', gap: spacing[2] },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.raised,
  },
  boxActive: { borderWidth: 2 },
  char: { fontSize: 20, fontWeight: fontWeights.semibold, color: colors.text.primary },
  hiddenInput: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0 },
});
