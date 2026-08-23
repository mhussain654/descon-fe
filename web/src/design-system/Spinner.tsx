import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Accessible label announced to assistive tech (e.g. an already-translated "Loading…"). */
  label: string;
}

/** Indeterminate progress indicator. Pair with ProgressBar for determinate progress. */
export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className="inline-flex text-brand">
      <Loader2 className={`${SIZE_CLASSES[size]} animate-spin`} aria-hidden="true" />
    </span>
  );
}
