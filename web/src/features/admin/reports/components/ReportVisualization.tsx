import { Card } from '../../../../design-system';
import type { ReportData, TrendGranularity } from '../../../../lib/admin-reports-client';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { CanonicalWorkflowStageCode } from '../../../../../../shared/adminWorkflow/canonicalStages';
import { PIPELINE_BUCKET_HEX, STAGE_TO_PIPELINE_BUCKET } from '../workflowPipelineBuckets';
import { CategoryBarChart, TrendChart, type CategoryDatum } from './ReportCharts';
import { emptyState, stageLabel, type TFn } from './ReportTables';

/** Visual report view. The corresponding accessible data remains available alongside it. */
export function ReportVisualization({ data, t, language, granularity }: { data: ReportData; t: TFn; language: Language; granularity: TrendGranularity }) {
  const bars = (rows: CategoryDatum[], countLabel = t('reportColumnCount')) => <Card className="min-w-0 overflow-x-auto"><p className="mb-3 text-sm font-semibold text-text-secondary">{countLabel}</p><div className="min-w-[360px]">{rows.some((row) => row.value > 0) ? <CategoryBarChart data={rows} showValues /> : emptyState(t)}</div></Card>;
  switch (data.type) {
    case 'status_summary':
    case 'conversion':
      return bars(data.rows.map((row) => ({ key: row.code, label: stageLabel(row.code, t), value: row.count, color: PIPELINE_BUCKET_HEX[STAGE_TO_PIPELINE_BUCKET[row.code as CanonicalWorkflowStageCode]] })));
    case 'craft_summary':
      return bars(data.rows.map((row) => ({ key: row.code, label: row.name, value: row.total, tone: 'success' })), t('reportColumnTotal'));
    case 'trend':
      return <Card className="min-w-0 overflow-x-auto"><div className="min-w-[360px]">{data.rows.length ? <TrendChart rows={data.rows} granularity={granularity} language={language} /> : emptyState(t)}</div></Card>;
    case 'mobilization':
      return <div className="grid gap-4 lg:grid-cols-2">{[data.summary.byCountry, data.summary.byProject].map((rows, index) => <section key={index}><h3 className="mb-2 font-semibold text-text-primary">{t(index === 0 ? 'mpsDashboardMobilizationByCountryTitle' : 'mpsDashboardMobilizationByProjectTitle')}</h3>{bars(rows.map((row) => ({ key: row.code, label: row.name, value: row.count, tone: 'info' })))}</section>)}</div>;
    case 'outcome_tracking':
      return bars([
        { key: 'rejectedDocuments', label: t('reportOutcomeRejectedDocuments'), value: data.summary.rejectedDocuments, tone: 'danger' },
        { key: 'qvcReMedical', label: t('reportOutcomeQvcReMedical'), value: data.summary.qvcReMedical, tone: 'warning' },
        { key: 'qvcRejected', label: t('reportOutcomeQvcRejected'), value: data.summary.qvcRejected, tone: 'danger' },
        { key: 'qvcNoShow', label: t('reportOutcomeQvcNoShow'), value: data.summary.qvcNoShow, tone: 'neutral' },
        { key: 'visaRejected', label: t('reportOutcomeVisaRejected'), value: data.summary.visaRejected, tone: 'danger' },
      ]);
  }
}
