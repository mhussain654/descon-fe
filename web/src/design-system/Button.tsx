import classNames from 'classnames';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and marks the control busy without changing its accessible name. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-emphasis',
  secondary: 'bg-gray-100 text-text-primary hover:bg-gray-200',
  outline: 'border border-border bg-background text-text-primary hover:bg-surface-sunken',
  destructive: 'bg-danger text-danger-on hover:bg-danger-emphasis',
  text: 'bg-transparent text-brand hover:bg-brand-subtle',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-sm font-medium',
  md: 'h-12 gap-2 rounded-xl px-6 text-base font-semibold',
  lg: 'h-14 gap-2 rounded-xl px-8 text-lg font-semibold',
};

/**
 * Primary/secondary/outline/destructive/text button. Renders a native
 * `<button>` -- use a link/anchor for navigation instead (AGENTS.md: "Use
 * buttons for actions and links for navigation").
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    fullWidth = false,
    leadingIcon,
    trailingIcon,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classNames(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full'
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading ? trailingIcon : null}
    </button>
  );
});
