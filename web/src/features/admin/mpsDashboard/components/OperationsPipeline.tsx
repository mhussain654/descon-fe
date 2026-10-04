import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Card, EmptyState } from '../../../../design-system';
import type { StatusSummaryRow, DashboardFilters } from '../../../../../../shared/adminReports/types';
import { writeDashboardFiltersToSearchParams } from '../../reports/dashboardFiltersUrlState';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import { CategoryBarChart } from '../../reports/components/ReportCharts';

const TONES = ['bg-brand-subtle text-brand', 'bg-info-subtle text-info-emphasis', 'bg-success-subtle text-success-emphasis', 'bg-warning-subtle text-warning-emphasis'] as const;

export function OperationsPipeline({ rows, filters, graphical = false, t }: { rows: StatusSummaryRow[]; filters: DashboardFilters; graphical?: boolean; t: TFn }) {
  const { language } = useLanguage();
  const active = rows.filter((row) => row.count > 0);
  const featured = [...active].sort((a, b) => b.count - a.count).slice(0, 6);
  const shown = graphical ? active : featured;
  function card(row: StatusSummaryRow, index: number) {
    const params = writeDashboardFiltersToSearchParams(filters);
    params.set('status', row.code);
    return <Link key={row.code} to={`/admin?${params}`} className={`flex min-w-0 items-center gap-3 rounded-xl p-4 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring ${TONES[index % TONES.length]}`}>
      <BarChart3 className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-semibold">{stageLabel(row.code, t)}</span>
      <strong className="text-xl tabular-nums">{formatNumber(row.count, language)}</strong>
      <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
    </Link>;
  }
  return <Card className="min-w-0 shadow-sm">
    <h2 className="text-base font-semibold text-text-primary"><span aria-hidden="true">📊 </span>{t('dashboardWorkflowStageQueueTitle')}</h2>
    <p className="mb-4 mt-1 text-xs text-text-secondary">{t('dashboardWorkflowStageQueueSubtitle')}</p>
    {active.length === 0 ? <EmptyState title={t('operationsPipelineEmpty')} /> : null}
    {graphical && active.length > 0 ? <div className="mb-5 max-h-96 overflow-auto rounded-xl bg-surface-sunken/40 p-3"><div className="min-w-[480px]"><CategoryBarChart data={active.map((row) => ({ key: row.code, label: stageLabel(row.code, t), value: row.count }))} /></div></div> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map(card)}</div>
    {graphical ? <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-brand">{t('adminCandidateListAllStages')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.filter((row) => row.count === 0).map(card)}</div></details> : null}
  </Card>;
}
