import { AlertTriangle, Ban, CheckCircle2, Clock, Hourglass, XCircle } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../../../../client-integrations/recharts';
import { toIntlLocale } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { TrendGranularity, TrendPoint } from '../../../../lib/admin-reports-client';
import type { AdminPaymentStatus } from '../../../../lib/admin-payments-client';
import type { KpiTrendPoint } from '../../../../../../shared/adminDashboard/types';

/**
 * Chart primitives shared by the Admin/MPS/Management dashboards and the
 * MIS report browser (Phase 1 of the admin portal redesign) -- colocated
 * with, not replacing, ReportTables.tsx's table/tile renderers. Every chart
 * here is rendered *alongside* its existing StatTile row or DataTable, never
 * instead of it: the table/tiles stay the accessible, exportable source of
 * truth (AGENTS.md WCAG requirement -- an unlabeled SVG chart is a poor
 * substitute for a real table for screen-reader users), the chart is a
 * supplementary visual summary marked `aria-hidden`.
 */

/**
 * Fixed hex values matching shared/design-tokens.ts's brand/success/warning/
 * danger/info -- these colors are static regardless of the admin portal's
 * light/dark theme (tailwind.config.js keeps them as literal hex, not CSS
 * vars, since they're not part of the theme-able neutral palette), so charts
 * built on them don't need any theme-reactive logic.
 */
export const CHART_TONE_HEX = {
  brand: '#0066CC',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#0284C7',
  neutral: '#9CA3AF',
} as const;

export type ChartTone = keyof typeof CHART_TONE_HEX;

/** The same tone vocabulary, as a StatTile `className` (soft-tinted background + matching text, e.g. `bg-danger-subtle text-danger-emphasis`) -- so a tile row and a chart built from the same data read as one coordinated color system instead of two. */
export const TONE_TILE_CLASSNAME: Record<ChartTone, string> = {
  brand: 'bg-brand-subtle text-brand',
  success: 'bg-success-subtle text-success-emphasis',
  warning: 'bg-warning-subtle text-warning-emphasis',
  danger: 'bg-danger-subtle text-danger-emphasis',
  info: 'bg-info-subtle text-info-emphasis',
  neutral: 'bg-surface-sunken text-text-secondary',
};

/**
 * Tones/icons for DOCUMENT_REVIEW_SUMMARY_ROWS's 5 keys (shared/adminDocumentReviews/
 * statusLabels.ts) -- mirrors the same semantic colors REVIEW_STATE_TONES/
 * QUEUE_STATUS_FILTER_ONLY_TONES already use for these exact statuses
 * elsewhere, just re-keyed to this row list's camelCase keys. Shared here
 * (not local to one component) since both AdminDashboard and
 * DocumentReviewQueue render the exact same 5-key summary shape.
 */
export const DOCUMENT_REVIEW_ROW_STYLE: Record<string, { tone: ChartTone; icon: typeof Clock }> = {
  pendingReview: { tone: 'info', icon: Clock },
  rejected: { tone: 'danger', icon: XCircle },
  expiredPcc: { tone: 'danger', icon: AlertTriangle },
  nearExpiryPcc: { tone: 'warning', icon: Hourglass },
  verified: { tone: 'success', icon: CheckCircle2 },
};

export const PAYMENT_STATUS_ICON: Record<AdminPaymentStatus, typeof Clock> = {
  checkout_pending: Clock,
  paid: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
};

export interface CategoryDatum {
  key: string;
  label: string;
  value: number;
  /** Defaults to 'brand' -- pass a distinct tone per item only where the categories are genuinely good/bad (payment status, document review outcome, ...), not for an ordered/neutral breakdown like a workflow-stage queue. */
  tone?: ChartTone;
}

// Grid lines/axis ticks are deliberately theme-static (not CSS-var-driven):
// a low-opacity slate reads fine as subtle chrome on both the light and
// dark admin surface, and recharts sets these as raw SVG attributes rather
// than inline CSS, which doesn't reliably resolve custom properties across
// browsers -- not worth the risk for supplementary chart chrome.
const GRID_STROKE = '#94A3B8';
const AXIS_TICK_STYLE = { fontSize: 11, fill: '#64748B' };

function hasAnyValue(data: { value: number }[]): boolean {
  return data.some((d) => d.value > 0);
}

/** Proportional breakdown of a handful (<=6) of categories -- a document-review queue, payment-status summary, or outcome-tracking counts. */
export function CategoryDonutChart({ data }: { data: CategoryDatum[] }) {
  if (!hasAnyValue(data)) return null;

  return (
    <div className="h-40 w-40 shrink-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} strokeWidth={0}>
            {data.map((d) => (
              <Cell key={d.key} fill={CHART_TONE_HEX[d.tone ?? 'brand']} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked/ordered breakdown across many categories (a 15-stage workflow queue, per-country mobilization, a conversion funnel) -- a horizontal bar reads better than a pie once there are more than a handful of slices. */
export function CategoryBarChart({ data }: { data: CategoryDatum[] }) {
  if (!hasAnyValue(data)) return null;
  const height = Math.max(160, data.length * 34);

  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} strokeOpacity={0.25} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d) => (
              <Cell key={d.key} fill={CHART_TONE_HEX[d.tone ?? 'brand']} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Time-series trend (mobilization over time, daily/weekly/monthly) as a filled area chart. */
export function TrendChart({
  rows,
  granularity,
  language,
}: {
  rows: TrendPoint[];
  granularity: TrendGranularity;
  language: Language;
}) {
  if (rows.length === 0) return null;

  // Not shared/i18n/locale.ts's formatDate: that helper always merges in a
  // `dateStyle: 'medium'` default, which Intl.DateTimeFormat rejects when
  // combined with component options like `month`/`year` here (throws
  // "Invalid option" at render time -- a real crash this caught). A tick
  // needs the shorter, granularity-specific component format, not a
  // dateStyle preset, so it builds its own Intl.DateTimeFormat directly.
  const tickFormat: Intl.DateTimeFormatOptions =
    granularity === 'monthly' ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' };
  const tickFormatter = new Intl.DateTimeFormat(toIntlLocale(language), tickFormat);
  const formatTick = (period: string) => tickFormatter.format(new Date(period));

  return (
    <div className="h-56" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="trendChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_TONE_HEX.brand} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_TONE_HEX.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} strokeOpacity={0.25} />
          <XAxis dataKey="period" tickFormatter={formatTick} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} width={32} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(value) => formatTick(String(value))} />
          <Area type="monotone" dataKey="count" stroke={CHART_TONE_HEX.brand} strokeWidth={2} fill="url(#trendChartFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Tiny axis-less trend line for a StatTile (a 14-day daily-event count --
 * see KpiTrendPoint). Purely decorative/supplementary, same as every other
 * chart here -- the tile's own number stays the accessible value, this is
 * never the only place the trend is conveyed.
 */
export function Sparkline({ data, tone = 'brand' }: { data: KpiTrendPoint[]; tone?: ChartTone }) {
  if (data.length === 0) return null;

  return (
    <div className="h-8 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparkline-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_TONE_HEX[tone]} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_TONE_HEX[tone]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="count" stroke={CHART_TONE_HEX[tone]} strokeWidth={1.5} fill={`url(#sparkline-${tone})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
