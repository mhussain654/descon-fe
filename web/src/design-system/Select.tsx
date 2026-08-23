// A native `<select>`, not a headless Radix/combobox primitive: every use
// so far (role assignment, status filters) is a small, closed, exhaustively-
// known option set with no search need, so the browser's own accessible,
// keyboard-native control is the right tool (AGENTS.md: "Do not add a large
// dependency for a small utility"). Mirrors Input.tsx's label/helper/error
// API shape so the two feel like one family.
import classNames from 'classnames';
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { ValidationMessage } from './ValidationMessage';

export interface SelectOption {
  value: string;
  /** Already-translated option label. */
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id'> {
  id?: string;
  /** Already-translated label text. */
  label?: string;
  /** Already-translated "Required"/"Optional" marker shown next to the label. */
  requirementText?: string;
  /** Already-translated neutral guidance shown when there's no error. */
  helperText?: string;
  /** Already-translated validation message. When set, the field is styled and marked invalid. */
  errorMessage?: string;
  options: SelectOption[];
  trailingIcon?: ReactNode;
}

/** Base select field: label, native `<select>`, helper text and validation message wired together with the right aria attributes. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, requirementText, helperText, errorMessage, options, trailingIcon, disabled, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const hasError = Boolean(errorMessage);

  return (
    <div>
      {label ? (
        <Label htmlFor={selectId} requirementText={requirementText}>
          {label}
        </Label>
      ) : null}
      <div className="relative flex items-center">
        <select
          {...props}
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={classNames(
            'h-12 w-full appearance-none rounded-xl border bg-background px-4 text-base text-text-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError ? 'border-danger' : 'border-border',
            trailingIcon ? 'pe-10' : undefined
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {trailingIcon ? (
          <span className="pointer-events-none absolute end-3 flex text-text-tertiary">{trailingIcon}</span>
        ) : null}
      </div>
      {hasError ? (
        <ValidationMessage id={errorId} tone="error">
          {errorMessage}
        </ValidationMessage>
      ) : helperText ? (
        <HelperText id={helperId}>{helperText}</HelperText>
      ) : null}
    </div>
  );
});
