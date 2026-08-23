export interface ProgressBarProps {
  /** 0-100. Values outside that range are clamped. */
  value: number;
  /** Already-translated accessible label, e.g. `t('mobilizationProgress')`. */
  label: string;
  /** Already-formatted display text shown under the bar, e.g. "30% complete". Optional -- the bar is still announced via aria attributes without it. */
  displayText?: string;
}

/** Determinate linear progress indicator. For indeterminate loading, use Spinner instead. */
export function ProgressBar({ value, label, displayText }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${clamped}%` }} />
      </div>
      {displayText ? <p className="mt-2 text-sm text-text-secondary">{displayText}</p> : null}
    </div>
  );
}
