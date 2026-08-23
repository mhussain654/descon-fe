import classNames from 'classnames';
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp';
import { useId } from 'react';
import { HelperText } from './HelperText';
import { ValidationMessage } from './ValidationMessage';

const DEFAULT_LENGTH = 6;

interface SlotBoxProps extends SlotProps {
  hasError: boolean;
}

function SlotBox({ char, isActive, hasFakeCaret, hasError }: SlotBoxProps) {
  return (
    <div
      className={classNames(
        'flex h-12 w-10 items-center justify-center rounded-xl border bg-background text-xl font-semibold text-text-primary sm:w-12',
        hasError ? 'border-danger' : isActive ? 'border-brand ring-2 ring-ring' : 'border-border'
      )}
    >
      {char}
      {hasFakeCaret ? <span className="h-5 w-px animate-pulse bg-brand" aria-hidden="true" /> : null}
    </div>
  );
}

export interface OtpFieldProps {
  id?: string;
  name?: string;
  length?: number;
  value: string;
  onValueChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Already-translated accessible name for the field, e.g. `t('enterOTP')`. */
  label: string;
  helperText?: string;
  errorMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * OTP presentation: one real input for correct mobile keyboard, autofill and
 * paste-across-boxes behavior (via `input-otp`), rendered as segmented boxes.
 * Forced left-to-right like CnicField -- an OTP is a numeral, not prose.
 */
export function OtpField({
  id,
  name,
  length = DEFAULT_LENGTH,
  value,
  onValueChange,
  onComplete,
  label,
  helperText,
  errorMessage,
  disabled,
  autoFocus,
}: OtpFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const hasError = Boolean(errorMessage);

  return (
    <div>
      <OTPInput
        id={inputId}
        name={name}
        dir="ltr"
        maxLength={length}
        value={value}
        onChange={onValueChange}
        onComplete={onComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="numeric"
        pattern={REGEXP_ONLY_DIGITS}
        aria-label={label}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
        containerClassName="flex items-center gap-2 has-[:disabled]:opacity-50"
        render={({ slots }) => (
          <>
            {slots.map((slot, index) => (
              // Positional boxes over one hidden input -- no stable identity beyond index.
              // eslint-disable-next-line react/no-array-index-key
              <SlotBox key={index} {...slot} hasError={hasError} />
            ))}
          </>
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
}
