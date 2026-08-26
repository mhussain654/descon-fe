import { useId, useRef } from 'react';
import { Button, HelperText, Label, ValidationMessage } from '../../../../design-system';
import type { CsvFileValidationError } from '../schemas/csvFile';

export interface CsvFileFieldProps {
  file: File | null;
  /** Already-mapped validation error, or `null` when the current selection (or lack of one) is valid so far. */
  error: CsvFileValidationError | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  labelText: string;
  helperText: string;
  chooseFileLabel: string;
  noFileChosenLabel: string;
  selectedFilePrefix: string;
  removeFileLabel: string;
  errorMessages: Record<CsvFileValidationError, string>;
}

/** Accessible CSV file picker: a native `<input type="file">` (visually hidden but focusable/operable) triggered by a labeled button, with the selected filename and a clear/remove action rendered as plain text -- never the raw file path. */
export function CsvFileField({
  file,
  error,
  onSelect,
  disabled,
  labelText,
  helperText,
  chooseFileLabel,
  noFileChosenLabel,
  selectedFilePrefix,
  removeFileLabel,
  errorMessages,
}: CsvFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <Label htmlFor={fieldId}>{labelText}</Label>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        aria-describedby={error ? `${helperId} ${errorId}` : helperId}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          {chooseFileLabel}
        </Button>
        <span className="text-sm text-text-secondary">
          {file ? `${selectedFilePrefix}: ${file.name}` : noFileChosenLabel}
        </span>
        {file ? (
          <Button type="button" variant="text" size="sm" onClick={() => onSelect(null)} disabled={disabled}>
            {removeFileLabel}
          </Button>
        ) : null}
      </div>
      <HelperText id={helperId}>{helperText}</HelperText>
      {error ? (
        <ValidationMessage id={errorId} tone="error">
          {errorMessages[error]}
        </ValidationMessage>
      ) : null}
    </div>
  );
}
