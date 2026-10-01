import classNames from 'classnames';
import type { ReactNode } from 'react';

export interface StatTileProps {
  value: ReactNode;
  /** Already-translated label -- design-system components never call useLanguage()/own copy (see README.md); callers pass `t(key)` themselves. */
  label: string;
  className?: string;
  labelClassName?: string;
  /** Optional leading icon (a lucide-react element), shown in a small badge above the value. Rendered with no explicit color of its own, so it inherits whatever tone `className` sets (e.g. `text-success-emphasis`) via `currentColor`, the same way the value number already does. */
  icon?: ReactNode;
  /** Optional small trend chart (e.g. ReportCharts.tsx's `Sparkline`), rendered below the label. Purely supplementary -- `value`/`label` stay the accessible content, additive to `icon` and not a breaking change for any existing caller. */
  trend?: ReactNode;
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
// text-text-secondary, not the previous hardcoded text-black: this tile is
// used inside admin dashboards, which now support a dark theme (see
// StaffShell's theme toggle) -- a hardcoded black label would stay black
// (near-invisible) against a dark card. text-text-secondary is also the
// same "muted supporting text" token CardDescription already uses, matching
// this label's role under a big stat number.
export function StatTile({ value, label, className, labelClassName = 'text-text-secondary', icon, trend }: StatTileProps) {
  return (
    <div className={classNames('flex-1 rounded-xl border border-black/5 p-4 text-center transition-shadow hover:shadow-sm', className)}>
      {icon ? (
        <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-current/10 [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className={classNames('mt-0.5 text-xs font-medium', labelClassName)}>{label}</div>
      {trend ? <div className="mt-2">{trend}</div> : null}
    </div>
  );
}
