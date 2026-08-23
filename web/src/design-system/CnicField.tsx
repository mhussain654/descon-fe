import { type ChangeEvent, useId } from 'react';
import { formatCnic, toCnicDigits } from '../../../shared/cnic';
import { HelperText } from './HelperText';
import { Label } from './Label';
import { ValidationMessage } from './ValidationMessage';

export { formatCnic, toCnicDigits };

export interface CnicFieldProps {
  id?: string;
  name?: string;
  /** Already-translated label, e.g. `t('cnic')`. */
  label?: string;
  requirementText?: string;
  helperText?: string;
  errorMessage?: string;
  /** Already-translated placeholder, e.g. `t('enterCNIC')`. */
  placeholder?: string;
  /** Raw digits only (no dashes) -- the component owns display formatting. */
  value: string;
  onValueChange: (digits: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * CNIC presentation: numeric-only, auto-grouped as 5-7-1, and forced to
 * left-to-right reading order even inside an Urdu/RTL layout, since a CNIC
 * is a numeral identifier rather than prose (AGENTS.md localization: "Test
 * mixed content such as CNIC numbers inside Urdu layouts").
 */
export function CnicField({
  id,
  name,
  label,
  requirementText,
  helperText,
  errorMessage,
  placeholder,
  value,
  onValueChange,
  disabled,
  autoFocus,
}: CnicFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(errorMessage);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onValueChange(toCnicDigits(event.target.value));
  };

  return (
    <div>
      {label ? (
        <Label htmlFor={inputId} requirementText={requirementText}>
          {label}
        </Label>
      ) : null}
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={formatCnic(value)}
        onChange={handleChange}
        maxLength={15}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
        className={`h-12 w-full rounded-xl border bg-background px-4 text-start text-base tabular-nums text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          hasError ? 'border-danger' : 'border-border'
        }`}
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
}
