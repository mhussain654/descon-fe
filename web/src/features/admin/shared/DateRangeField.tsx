import { useId } from 'react';

export interface DateRange {
  /** YYYY-MM-DD. */
  from?: string;
  /** YYYY-MM-DD. */
  to?: string;
}

interface DateRangeFieldProps {
  /** Already-translated field label, shown once above both inputs. */
  label: string;
  /** Already-translated accessible names for the two inputs, e.g. "Paid from" / "Paid to". */
  fromLabel: string;
  toLabel: string;
  value: DateRange;
  onChange: (patch: DateRange) => void;
}

/**
 * One labelled date range: a "from" and a "to" date input joined in a single
 * box, so a filter row spends one field on a range instead of two.
 */
export function DateRangeField({ label, fromLabel, toLabel, value, onChange }: DateRangeFieldProps) {
  const legendId = useId();
  const inputClassName =
    'h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
  return (
    <fieldset aria-labelledby={legendId} className="min-w-0">
      <legend id={legendId} className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
      </legend>
      <div className="flex h-12 items-center overflow-hidden rounded-xl border border-border bg-background">
        <input
          type="date"
          aria-label={fromLabel}
          value={value.from ?? ''}
          max={value.to}
          onChange={(event) => onChange({ from: event.target.value || undefined })}
          className={`${inputClassName} rounded-s-xl`}
        />
        <span aria-hidden="true" className="px-1 text-text-tertiary">
          –
        </span>
        <input
          type="date"
          aria-label={toLabel}
          value={value.to ?? ''}
          min={value.from}
          onChange={(event) => onChange({ to: event.target.value || undefined })}
          className={`${inputClassName} rounded-e-xl`}
        />
      </div>
    </fieldset>
  );
}
