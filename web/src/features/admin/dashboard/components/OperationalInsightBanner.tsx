import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { AdminDashboardSummary } from '../../../../../../shared/adminDashboard/types';
import type { TFn } from '../../reports/components/ReportTables';
import { InsightBanner } from '../../reports/components/InsightBanner';
import { ATTENTION_HINT_KEYS, ATTENTION_LABEL_KEYS, ATTENTION_LINK_PATH } from '../requiresAttentionMeta';

interface Insight {
  text: string;
  linkPath?: string;
}

/**
 * Picks the single largest non-zero requires_attention exception, if any --
 * the same data RequiresAttentionPanel already lists, just surfaced as the
 * one thing most worth a click. Falls back to the real verification rate
 * (from conversion_funnel, already computed by the existing ConversionQuery)
 * when nothing needs attention, so the banner never has nothing true to say.
 */
function buildInsight(data: AdminDashboardSummary, t: TFn, language: Language): Insight | null {
  const topAttention = [...data.requiresAttention].filter((row) => row.count > 0).sort((a, b) => b.count - a.count)[0];

  if (topAttention) {
    const label = t(ATTENTION_LABEL_KEYS[topAttention.code]).toLowerCase();
    const hint = t(ATTENTION_HINT_KEYS[topAttention.code]);
    return { text: `${topAttention.count} ${label} — ${hint}.`, linkPath: ATTENTION_LINK_PATH[topAttention.code] };
  }

  const verified = data.conversionFunnel.find((row) => row.code === 'verified');
  if (verified) {
    const percentage = formatNumber(verified.percentage, language, { maximumFractionDigits: 1 });
    return { text: `${percentage}% ${t('adminDashboardInsightVerifiedSuffix')}.` };
  }

  return null;
}

export function OperationalInsightBanner({ data, t, language }: { data: AdminDashboardSummary; t: TFn; language: Language }) {
  const insight = buildInsight(data, t, language);
  if (!insight) return null;

  return (
    <InsightBanner
      title={t('adminDashboardInsightTitle')}
      text={insight.text}
      linkPath={insight.linkPath}
      linkLabel={t('adminDashboardInsightReviewLink')}
    />
  );
}
