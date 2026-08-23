import { Search, X } from 'lucide-react';
import { type ChangeEvent, useId } from 'react';
import { IconButton } from './IconButton';

export interface SearchFieldProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Already-translated placeholder, e.g. `t('adminSearchPlaceholder')`. */
  placeholder?: string;
  /** Already-translated accessible name for the field itself. */
  label: string;
  /** Already-translated accessible name for the clear button. */
  clearLabel: string;
  disabled?: boolean;
}

/** Search control with a leading icon and a clear button once there's a query to clear. */
export function SearchField({ id, value, onValueChange, placeholder, label, clearLabel, disabled }: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value);

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute start-3 h-4 w-4 text-text-tertiary" aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        role="searchbox"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-border bg-background ps-10 pe-10 text-base text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {value ? (
        <span className="absolute end-1.5">
          <IconButton
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            label={clearLabel}
            size="sm"
            variant="ghost"
            onClick={() => onValueChange('')}
          />
        </span>
      ) : null}
    </div>
  );
}
