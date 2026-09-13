import classNames from 'classnames';
import type { ReactNode } from 'react';

export interface StatTileProps {
  value: ReactNode;
  /** Already-translated label -- design-system components never call useLanguage()/own copy (see README.md); callers pass `t(key)` themselves. */
  label: string;
  className?: string;
  labelClassName?: string;
}

/**
 * Small value/label stat tile, promoted from its original local/unexported
 * home in web/src/app/documents/page.jsx (candidate document checklist
 * counts) for reuse across the Admin/MPS/Management dashboards (MPS-801/
 * 802/803), which need the same tile three times over. Callers there and
 * here both pass an already-translated `label`, unlike the original which
 * took a `labelKey` and called `useLanguage()` itself -- fixed during this
 * promotion to match every other design-system component's convention.
 */
export function StatTile({ value, label, className, labelClassName = 'text-black' }: StatTileProps) {
  return (
    <div className={classNames('flex-1 rounded-xl border border-black/5 p-4 text-center transition-shadow hover:shadow-sm', className)}>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className={classNames('mt-0.5 text-xs font-medium', labelClassName)}>{label}</div>
    </div>
  );
}
