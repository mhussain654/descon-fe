export interface ProgressBarProps {
  /** 0-100. Values outside that range are clamped. */
  value: number;
  /** Already-translated accessible label, e.g. `t('mobilizationProgress')`. */
  label: string;
  /** Already-formatted display text shown under the bar, e.g. "30% complete". Optional -- the bar is still announced via aria attributes without it. */
  displayText?: string;
  /**
   * Optional fixed hex fill color, for a caller distinguishing several bars
   * from each other (e.g. one per category in a ranked breakdown) rather
   * than showing a single ongoing progress toward 100%. Inline `style`,
   * same as ReportCharts.tsx's chart-tone hex values -- there is no static
   * Tailwind token for an arbitrary per-item color, and this isn't styling
   * a fixed brand color would otherwise cover. Defaults to the standard
   * `bg-brand` fill when omitted.
   */
  fillColor?: string;
}

/** Determinate linear progress indicator. For indeterminate loading, use Spinner instead. */
export function ProgressBar({ value, label, displayText, fillColor }: ProgressBarProps) {
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
        <div
          className={fillColor ? 'h-full rounded-full transition-[width]' : 'h-full rounded-full bg-brand transition-[width]'}
          style={{ width: `${clamped}%`, backgroundColor: fillColor }}
        />
      </div>
      {displayText ? <p className="mt-2 text-sm text-text-secondary">{displayText}</p> : null}
    </div>
  );
}
