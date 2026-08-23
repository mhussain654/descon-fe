import classNames from 'classnames';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type IconButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: ReactNode;
  /** Required: becomes the button's accessible name since it has no visible text. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-emphasis',
  outline: 'border border-border bg-background text-text-primary hover:bg-surface-sunken',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-sunken',
  destructive: 'bg-danger text-danger-on hover:bg-danger-emphasis',
};

// Square footprint at or above the 44px minimum touch target (shared/design-tokens.ts `minTouchTarget`).
const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-11 w-11 rounded-xl',
  lg: 'h-14 w-14 rounded-xl',
};

/** Icon-only button with a mandatory accessible name -- the standard shape for compact toolbar/list actions. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', loading = false, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classNames(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size]
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
    </button>
  );
});
