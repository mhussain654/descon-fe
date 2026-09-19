import { Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import type { Language } from '../../../../../../shared/i18n/translations';
import type { AdminDashboardSummary } from '../../../../../../shared/adminDashboard/types';
import type { TFn } from '../../reports/components/ReportTables';
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

/**
 * A single real, computed sentence about the pipeline's current state --
 * never AI-generated prose. Built only from numbers the dashboard response
 * already contains (requires_attention/conversion_funnel), so it can never
 * say something the panels below don't already back up. Renders nothing
 * when there's genuinely no data to summarize yet.
 */
export function OperationalInsightBanner({ data, t, language }: { data: AdminDashboardSummary; t: TFn; language: Language }) {
  const insight = buildInsight(data, t, language);
  if (!insight) return null;

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-text-primary">{t('adminDashboardInsightTitle')}</div>
          <p className="text-sm text-text-secondary">{insight.text}</p>
        </div>
      </div>
      {insight.linkPath ? (
        <Link to={insight.linkPath} className="shrink-0 text-sm font-medium text-brand hover:underline">
          {t('adminDashboardInsightReviewLink')}
        </Link>
      ) : null}
    </div>
  );
}
