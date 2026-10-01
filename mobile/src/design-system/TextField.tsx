import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { colors, radii, spacing } from './tokens';
import { ValidationMessage } from './ValidationMessage';
import { getFontFamily } from './fonts';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Already-translated label text. */
  label?: string;
  /** Already-translated "Required"/"Optional" marker shown next to the label. */
  requirementText?: string;
  /** Already-translated neutral guidance shown when there's no error. */
  helperText?: string;
  /** Already-translated validation message. When set, the field is styled as invalid. */
  errorMessage?: string;
  /** Which font family renders the label/input/helper/error text -- this component never calls `useLanguage()` itself (see README's "Localization" section); the caller passes the active language through. */
  language?: 'en' | 'ur';
}

/** Base text field: label, input, helper text and validation message wired together. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, requirementText, helperText, errorMessage, editable, language = 'en', ...props },
  ref
) {
  const hasError = Boolean(errorMessage);

  return (
    <View>
      {label ? (
        <Label requirementText={requirementText} language={language}>
          {label}
        </Label>
      ) : null}
      <TextInput
        {...props}
        ref={ref}
        editable={editable}
        placeholderTextColor={colors.text.tertiary}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: editable === false }}
        style={[
          styles.input,
          { borderColor: hasError ? colors.danger.default : colors.border.default, fontFamily: getFontFamily(language, 'regular') },
          editable === false && styles.disabled,
        ]}
      />
      {errorMessage ? (
        <ValidationMessage tone="error" language={language}>
          {errorMessage}
        </ValidationMessage>
      ) : helperText ? (
        <HelperText language={language}>{helperText}</HelperText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.surface.raised,
  },
  disabled: { opacity: 0.5 },
});
