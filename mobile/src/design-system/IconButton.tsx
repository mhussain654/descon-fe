import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors, minTouchTarget, radii } from './tokens';

export type IconButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  icon: ReactNode;
  /** Required: becomes the control's accessible name since it has no visible text. */
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_BACKGROUND: Record<IconButtonVariant, string> = {
  primary: colors.brand.default,
  outline: colors.surface.raised,
  ghost: 'transparent',
  destructive: colors.danger.default,
};

// Square footprint at or above the 44px minimum touch target (shared/design-tokens.ts `minTouchTarget`).
const SIZES: Record<IconButtonSize, number> = { sm: minTouchTarget, md: minTouchTarget, lg: 56 };

/** Icon-only control with a mandatory accessible name, sized to the minimum recommended touch target. */
export function IconButton({ icon, label, onPress, variant = 'ghost', size = 'md', loading, disabled, style }: IconButtonProps) {
  const isDisabled = disabled || loading;
  const dimension = SIZES[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          width: dimension,
          height: dimension,
          backgroundColor: VARIANT_BACKGROUND[variant],
          borderColor: variant === 'outline' ? colors.border.default : undefined,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'ghost' || variant === 'outline' ? colors.text.secondary : colors.brand.on} />
      ) : (
        icon
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
});
