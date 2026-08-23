import classNames from 'classnames';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { ValidationMessage } from './ValidationMessage';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  id?: string;
  /** Already-translated label text. */
  label?: string;
  /** Already-translated "Required"/"Optional" marker shown next to the label. */
  requirementText?: string;
  /** Already-translated neutral guidance shown when there's no error. */
  helperText?: string;
  /** Already-translated validation message. When set, the field is styled and marked invalid. */
  errorMessage?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** Base text field: label, input, helper text and validation message wired together with the right aria attributes. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, requirementText, helperText, errorMessage, leadingIcon, trailingIcon, disabled, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(errorMessage);

  return (
    <div>
      {label ? (
        <Label htmlFor={inputId} requirementText={requirementText}>
          {label}
        </Label>
      ) : null}
      <div className="relative flex items-center">
        {leadingIcon ? (
          <span className="pointer-events-none absolute start-3 flex text-text-tertiary">{leadingIcon}</span>
        ) : null}
        <input
          {...props}
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
          className={classNames(
            'h-12 w-full rounded-xl border bg-background px-4 text-base text-text-primary placeholder:text-text-tertiary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            hasError ? 'border-danger' : 'border-border',
            leadingIcon ? 'ps-10' : undefined,
            trailingIcon ? 'pe-10' : undefined
          )}
        />
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
