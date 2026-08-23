import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fontWeights, minTouchTarget, radii, spacing } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 40, paddingHorizontal: spacing[3], fontSize: 14 },
  md: { height: 48, paddingHorizontal: spacing[6], fontSize: 16 },
  lg: { height: 56, paddingHorizontal: spacing[8], fontSize: 18 },
};

const VARIANT_STYLES: Record<ButtonVariant, { background: string; text: string; border?: string }> = {
  primary: { background: colors.brand.default, text: colors.brand.on },
  secondary: { background: colors.surface.sunken, text: colors.text.primary },
  outline: { background: colors.surface.raised, text: colors.text.primary, border: colors.border.default },
  destructive: { background: colors.danger.default, text: colors.danger.on },
  text: { background: 'transparent', text: colors.brand.default },
};

/** Primary/secondary/outline/destructive/text button. Height is never below the 44px minimum touch target. */
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizeStyle = SIZES[size];
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: Math.max(sizeStyle.height, minTouchTarget),
          paddingHorizontal: sizeStyle.paddingHorizontal,
          backgroundColor: variantStyle.background,
          borderColor: variantStyle.border,
          borderWidth: variantStyle.border ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        leadingIcon
      )}
      <Text style={[styles.text, { color: variantStyle.text, fontSize: sizeStyle.fontSize }]}>{children}</Text>
      {!loading ? trailingIcon : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: radii.lg,
  },
  text: {
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
});
