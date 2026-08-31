import { useId, useRef } from 'react';
import { Button, Label, ValidationMessage } from '../../../../design-system';

export interface WorkflowFileFieldProps {
  file: File | null;
  /** Already-localized message, or `undefined` when the current selection (or lack of one) is valid so far. */
  error: string | undefined;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  labelText: string;
  chooseFileLabel: string;
  noFileChosenLabel: string;
  selectedFilePrefix: string;
  removeFileLabel: string;
}

/**
 * Accessible private-document file picker shared by the visa-copy and
 * flight-ticket upload dialogs (MPS-F501 Phase C) -- same accessible shape
 * as candidate-import's CsvFileField.tsx (hidden native input, triggered by
 * a labeled button, selected filename shown as plain text, never a raw file
 * path). `accept` is an advisory UI filter only -- the backend remains the
 * authority on what it actually stores.
 */
export function WorkflowFileField({
  file,
  error,
  onSelect,
  disabled,
  labelText,
  chooseFileLabel,
  noFileChosenLabel,
  selectedFilePrefix,
  removeFileLabel,
}: WorkflowFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <Label htmlFor={fieldId}>{labelText}</Label>
      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
          {chooseFileLabel}
        </Button>
        <span className="text-sm text-text-secondary">{file ? `${selectedFilePrefix}: ${file.name}` : noFileChosenLabel}</span>
        {file ? (
          <Button type="button" variant="text" size="sm" onClick={() => onSelect(null)} disabled={disabled}>
            {removeFileLabel}
          </Button>
        ) : null}
      </div>
      {error ? (
        <ValidationMessage id={errorId} tone="error">
          {error}
        </ValidationMessage>
      ) : null}
    </div>
  );
}
