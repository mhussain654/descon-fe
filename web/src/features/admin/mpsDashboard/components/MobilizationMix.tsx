import { Building2, Globe } from 'lucide-react';
import { Link } from 'react-router';
import { Card, EmptyState } from '../../../../design-system';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { MobilizationRow, MobilizationSummary } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';

function BreakdownList({
  icon: Icon,
  label,
  rows,
  total,
  emptyText,
  language,
}: {
  icon: typeof Globe;
  label: string;
  rows: MobilizationRow[];
  total: number;
  emptyText: string;
  language: Language;
}) {
  const visibleRows = rows.slice(0, 5);
  const largestCount = Math.max(...visibleRows.map((row) => row.count), 0);

  return (
    <div className="rounded-xl bg-surface-sunken/60 p-4">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-text-secondary">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      {visibleRows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visibleRows.map((row, index) => {
            const share = total > 0 ? (row.count / total) * 100 : 0;
            const width = largestCount > 0 ? (row.count / largestCount) * 100 : 0;
            return (
              <div key={`${row.code}-${index}`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className={index === 0 ? 'font-semibold text-text-primary' : 'text-text-primary'}>{row.name}</span>
                  <span className="tabular-nums text-text-secondary">
                    {formatNumber(row.count, language)} · {formatNumber(share, language, { maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title={emptyText} />
      )}
    </div>
  );
}

/** Compact ranked country/project breakdown; Reports remains the complete view. */
export function MobilizationMix({ summary, t, language }: { summary: MobilizationSummary; t: TFn; language: Language }) {
  const countryTotal = summary.byCountry.reduce((sum, row) => sum + row.count, 0);
  const projectTotal = summary.byProject.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="shadow-sm">
      <h2 className="text-base font-semibold text-text-primary">{t('mpsDashboardMobilizationMixTitle')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('mpsDashboardMobilizationMixSubtitle')}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BreakdownList
          icon={Globe}
          label={t('mpsDashboardMobilizationByCountryTitle')}
          rows={summary.byCountry}
          total={countryTotal}
          emptyText={t('mpsDashboardMobilizationMixEmpty')}
          language={language}
        />
        <BreakdownList
          icon={Building2}
          label={t('mpsDashboardMobilizationByProjectTitle')}
          rows={summary.byProject}
          total={projectTotal}
          emptyText={t('mpsDashboardMobilizationMixEmpty')}
          language={language}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Link to="/admin/reports" className="text-xs font-medium text-brand hover:underline">
          {t('mpsDashboardMobilizationViewReport')}
        </Link>
      </div>
    </Card>
  );
}
