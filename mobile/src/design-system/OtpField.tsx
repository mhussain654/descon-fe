import { useEffect, useRef, useState } from 'react';
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
  /** Which font family renders `helperText`/`errorMessage` -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. The digit boxes themselves always use the Latin/numeral rendering regardless (see README's RTL section -- an OTP is a numeral, not prose). */
  language?: 'en' | 'ur';
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
  language = 'en',
}: OtpFieldProps) {
  const [isFocused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onValueChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  // A rejected code clears `value` back to '' (see useCnicOtpFlow's
  // OTP_CLEARING_ERRORS), but `autoFocus` only fires once on mount -- and
  // submitting a complete code typically dismisses the keyboard. Without
  // this, the candidate has to notice the error and manually tap the field
  // again before they can retry, which reads as "the field stopped
  // working" rather than "type the code again".
  useEffect(() => {
    if (hasError && editable !== false) {
      inputRef.current?.focus();
    }
  }, [hasError, editable]);

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
          ref={inputRef}
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
        <ValidationMessage tone="error" language={language}>
          {errorMessage}
        </ValidationMessage>
      ) : helperText ? (
        <HelperText language={language}>{helperText}</HelperText>
      ) : null}
    </View>
  );
}

const BOX_HEIGHT = 50;

const styles = StyleSheet.create({
  boxRow: { position: 'relative', flexDirection: 'row', gap: spacing[1.5] },
  // Boxes share the row's width (rather than a fixed size) so six of them fit
  // any phone width with even gaps.
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    borderWidth: 1.5,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.background,
  },
  boxActive: { borderWidth: 2, backgroundColor: colors.surface.raised },
  char: { fontSize: 20, fontWeight: fontWeights.bold, color: colors.text.primary },
  hiddenInput: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: 0 },
});
