import { Building2, Globe } from 'lucide-react';
import { Card } from '../../../../design-system';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { MobilizationRow, MobilizationSummary } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';

function HighlightTile({
  icon: Icon,
  label,
  row,
  total,
  emptyText,
  t,
  language,
}: {
  icon: typeof Globe;
  label: string;
  row: MobilizationRow | null;
  total: number;
  emptyText: string;
  t: TFn;
  language: Language;
}) {
  const percentage = row && total > 0 ? (row.count / total) * 100 : 0;

  return (
    <div className="rounded-xl bg-surface-sunken/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text-secondary">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      {row ? (
        <>
          <p className="text-lg font-semibold text-text-primary">{row.name}</p>
          <p className="text-xs text-text-secondary">
            {formatNumber(row.count, language)} · {formatNumber(percentage, language, { maximumFractionDigits: 1 })}%
          </p>
        </>
      ) : (
        <p className="text-sm text-text-secondary">{emptyText}</p>
      )}
    </div>
  );
}

/**
 * "At a glance" highlight of the single largest country/project by
 * mobilized headcount -- MobilizationQuery already returns both lists
 * sorted by count descending, so the first row of each is the top one, no
 * new backend work needed. Additive to, never a replacement for, the full
 * per-country/per-project breakdown MobilizationTables already renders
 * below this -- collapsing to "just the top one" would drop real
 * information the full tables still show.
 */
export function MobilizationMix({ summary, t, language }: { summary: MobilizationSummary; t: TFn; language: Language }) {
  const totalMobilized = summary.byCountry.reduce((sum, row) => sum + row.count, 0);
  const topCountry = summary.byCountry[0] ?? null;
  const topProject = summary.byProject[0] ?? null;

  return (
    <Card className="shadow-sm">
      <h2 className="text-base font-semibold text-text-primary">{t('mpsDashboardMobilizationMixTitle')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('mpsDashboardMobilizationMixSubtitle')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <HighlightTile
          icon={Globe}
          label={t('mpsDashboardTopCountry')}
          row={topCountry}
          total={totalMobilized}
          emptyText={t('mpsDashboardMobilizationMixEmpty')}
          t={t}
          language={language}
        />
        <HighlightTile
          icon={Building2}
          label={t('mpsDashboardTopProject')}
          row={topProject}
          total={totalMobilized}
          emptyText={t('mpsDashboardMobilizationMixEmpty')}
          t={t}
          language={language}
        />
      </div>
    </Card>
  );
}
