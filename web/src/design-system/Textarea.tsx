import classNames from 'classnames';
import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { ValidationMessage } from './ValidationMessage';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {
  id?: string;
  /** Already-translated label text. */
  label?: string;
  /** Already-translated "Required"/"Optional" marker shown next to the label. */
  requirementText?: string;
  /** Already-translated neutral guidance shown when there's no error. */
  helperText?: string;
  /** Already-translated validation message. When set, the field is styled and marked invalid. */
  errorMessage?: string;
}

/** Multi-line text field, structurally identical to Input (label/helper/error/aria wiring) -- for free-text content too long for a single-line field, e.g. a rejection reason. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, requirementText, helperText, errorMessage, disabled, rows = 4, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;
  const hasError = Boolean(errorMessage);

  return (
    <div>
      {label ? (
        <Label htmlFor={textareaId} requirementText={requirementText}>
          {label}
        </Label>
      ) : null}
      <textarea
        {...props}
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
        className={classNames(
          'w-full resize-y rounded-xl border bg-background px-4 py-3 text-base text-text-primary placeholder:text-text-tertiary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          hasError ? 'border-danger' : 'border-border'
        )}
      />
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
