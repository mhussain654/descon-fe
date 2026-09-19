import { Link } from 'react-router';
import { EmptyState } from '../../../../design-system';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { CraftSummaryRow } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';

const DASHBOARD_ROW_LIMIT = 8;

function rateFor(row: CraftSummaryRow): number {
  return row.total > 0 ? (row.mobilized / row.total) * 100 : 0;
}

/** A bounded craft ranking for operations; Reports remains the complete list. */
export function CraftPerformancePanel({
  rows,
  t,
  language,
}: {
  rows: CraftSummaryRow[];
  t: TFn;
  language: Language;
}) {
  if (rows.length === 0) {
    return <EmptyState title={t('dashboardEmptyTitle')} description={t('dashboardEmptyDescription')} />;
  }

  const visibleRows = rows.slice(0, DASHBOARD_ROW_LIMIT);
  const largestTotal = Math.max(...visibleRows.map((row) => row.total), 0);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary" aria-hidden="true">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-success" />
          {t('reportColumnMobilized')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          {t('mpsDashboardCraftRemaining')}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-surface-sunken text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 text-start font-medium">{t('reportColumnName')}</th>
              <th className="w-2/5 px-4 py-3 text-start font-medium">
                {t('mpsDashboardCraftSummaryChartTitle')}
              </th>
              <th className="px-4 py-3 text-end font-medium">{t('reportColumnTotal')}</th>
              <th className="px-4 py-3 text-end font-medium">{t('reportColumnMobilized')}</th>
              <th className="px-4 py-3 text-end font-medium">{t('reportColumnRate')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const totalWidth = largestTotal > 0 ? (row.total / largestTotal) * 100 : 0;
              const mobilizedWidth = row.total > 0 ? (row.mobilized / row.total) * 100 : 0;
              const rate = rateFor(row);
              return (
                <tr key={`${row.code}-${index}`} className="border-t border-border even:bg-surface-sunken/40">
                  <td className="px-4 py-3 font-medium text-text-primary">{row.name}</td>
                  <td className="px-4 py-3">
                    <div className="h-3 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                      <div className="h-full rounded-full bg-border" style={{ width: `${totalWidth}%` }}>
                        <div className="h-full rounded-full bg-success" style={{ width: `${mobilizedWidth}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-text-primary">
                    {formatNumber(row.total, language)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-text-primary">
                    {formatNumber(row.mobilized, language)}
                  </td>
                  <td
                    className={
                      rate > 0
                        ? 'px-4 py-3 text-end font-semibold tabular-nums text-success-emphasis'
                        : 'px-4 py-3 text-end tabular-nums text-text-secondary'
                    }
                  >
                    {formatNumber(rate, language, { maximumFractionDigits: 1 })}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-text-secondary">
        <span>{t('mpsDashboardCraftShowingTop')}</span>
        <Link to="/admin/reports" className="font-medium text-brand hover:underline">
          {t('mpsDashboardCraftViewAll')}
        </Link>
      </div>
    </>
  );
}
