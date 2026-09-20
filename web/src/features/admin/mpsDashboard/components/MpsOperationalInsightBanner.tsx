import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { MpsDashboardSummary } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';
import { InsightBanner } from '../../reports/components/InsightBanner';
import { PIPELINE_BUCKET_LABEL_KEYS, PIPELINE_BUCKET_ORDER, groupStagesByPipelineBucket } from '../../reports/workflowPipelineBuckets';

/** The largest pipeline-phase bucket by candidate count, or null when the pipeline is empty -- see workflowPipelineBuckets.ts for the same 15-stage rollup the Workflow pipeline card already visualizes. */
function largestBucketLabel(data: MpsDashboardSummary, t: TFn): string | null {
  const totals = groupStagesByPipelineBucket(data.workflowStageQueue);
  const largest = PIPELINE_BUCKET_ORDER.reduce((best, bucket) => (totals[bucket] > totals[best] ? bucket : best), PIPELINE_BUCKET_ORDER[0]);
  return totals[largest] > 0 ? t(PIPELINE_BUCKET_LABEL_KEYS[largest]) : null;
}

/**
 * Real, computed insight for the Operations dashboard -- never AI-generated.
 * Leads with critical, then delayed, cases (the same counts the KPI row and
 * requires-attention panel already show), paired with where pipeline volume
 * is concentrated. Falls back to the real verification rate when nothing is
 * delayed, so the banner never has nothing true to say. No link: unlike the
 * Admin dashboard's exceptions, there's no dedicated page today that shows
 * "just the delayed/critical cases" to send staff to -- omitted rather than
 * pointed at something that wouldn't actually filter to it.
 */
function buildInsight(data: MpsDashboardSummary, t: TFn, language: Language): { text: string } | null {
  const bucket = largestBucketLabel(data, t);
  const concentrationClause = bucket ? `${t('mpsDashboardInsightConcentrationPrefix')} ${bucket}` : null;

  if (data.delayedCases.critical > 0) {
    const base = `${data.delayedCases.critical} ${t('mpsDashboardInsightCriticalSuffix')}`;
    return { text: concentrationClause ? `${base}; ${concentrationClause}.` : `${base}.` };
  }

  if (data.delayedCases.delayed > 0) {
    const base = `${data.delayedCases.delayed} ${t('mpsDashboardInsightDelayedSuffix')}`;
    return { text: concentrationClause ? `${base}; ${concentrationClause}.` : `${base}.` };
  }

  const verified = data.conversionFunnel.find((row) => row.code === 'verified');
  if (verified) {
    const percentage = formatNumber(verified.percentage, language, { maximumFractionDigits: 1 });
    return { text: `${percentage}% ${t('adminDashboardInsightVerifiedSuffix')}.` };
  }

  return null;
}

export function MpsOperationalInsightBanner({ data, t, language }: { data: MpsDashboardSummary; t: TFn; language: Language }) {
  const insight = buildInsight(data, t, language);
  if (!insight) return null;

  return <InsightBanner title={t('adminDashboardInsightTitle')} text={insight.text} />;
}
