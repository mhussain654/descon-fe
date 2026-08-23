import classNames from 'classnames';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** Toggleable filter pill, e.g. a stage filter above a candidate list/table. */
export function FilterChip({ selected, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected ? 'bg-brand text-brand-on' : 'bg-surface-sunken text-text-secondary hover:bg-gray-200'
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
