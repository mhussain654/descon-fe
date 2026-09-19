import { useEffect } from 'react';
import { Clock, Plane, Timer, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, StatTile } from '../../../../design-system';
import { ADMIN_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminDashboard/errorMessages';
import { DOCUMENT_REVIEW_SUMMARY_ROWS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import { ADMIN_PAYMENT_STATUS_KEYS, ADMIN_PAYMENT_STATUS_TONES } from '../../../../../../shared/adminPayments/paymentLabels';
import type { AdminPaymentStatus } from '../../../../lib/admin-payments-client';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { stageLabel, type TFn } from '../../reports/components/ReportTables';
import {
  CategoryDonutChart,
  DOCUMENT_REVIEW_ROW_STYLE,
  PAYMENT_STATUS_ICON,
  Sparkline,
  TONE_TILE_CLASSNAME,
} from '../../reports/components/ReportCharts';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { WorkflowPipelineOverview } from './WorkflowPipelineOverview';
import { RequiresAttentionPanel } from './RequiresAttentionPanel';
import { UpcomingActivitiesPanel } from './UpcomingActivitiesPanel';
import { RecentlyUpdatedCandidatesTable } from './RecentlyUpdatedCandidatesTable';
import { formatNumber } from '../../../../../../shared/i18n/locale';

/**
 * The Admin dashboard (MPS-801): candidate workload, workflow-stage queue,
 * document-review queue depth, and payment visibility. No RequireStaffAuth
 * permission prop -- gating happens via the query's own FORBIDDEN state,
 * same as PaymentTransactionList.tsx.
 */
export function AdminDashboard() {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const query = useAdminDashboard();

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Solid brand blue, not a gradient -- this is a compliance/ops tool
          (visa, medical, government-BU workflows), not a consumer app, so
          the banner stays in the app's existing brand color rather than
          reaching for a decorative multi-color wash. */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-brand px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{t('adminDashboardTitle')}</h1>
          <p className="text-sm text-white/80">{t('adminDashboardSubtitle')}</p>
        </div>
        {hasPermission('manage_candidates') ? (
          <Link
            to="/admin/candidates/new"
            className="inline-flex h-10 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-medium text-brand hover:bg-white/90"
          >
            {t('adminAddCandidate')}
          </Link>
        ) : null}
      </div>

      <DashboardContent query={query} t={t} language={language} />
    </div>
  );
}

function DashboardContent({
  query,
  t,
  language,
}: {
  query: ReturnType<typeof useAdminDashboard>;
  t: TFn;
  language: Language;
}) {
  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return (
        <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      );
    }
    if (error?.code === 'FORBIDDEN') {
      return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    }
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') {
      // signOut() (triggered above) hands off to RequireStaffAuth's own redirect -- nothing further to render here.
      return null;
    }
    const messageKey = (error ? ADMIN_DASHBOARD_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data) return null;

  const documentReviewChartData = DOCUMENT_REVIEW_SUMMARY_ROWS.map((row) => ({
    key: row.key,
    label: t(row.labelKey as TranslationKey),
    value: data.documentReviewQueue[row.key],
    tone: DOCUMENT_REVIEW_ROW_STYLE[row.key]?.tone,
  }));

  const paymentChartData = data.paymentSummary.map((row) => ({
    key: row.code,
    label: t((ADMIN_PAYMENT_STATUS_KEYS[row.code as AdminPaymentStatus] ?? 'candidateDocumentsStatusUnknown') as TranslationKey),
    value: row.count,
    tone: ADMIN_PAYMENT_STATUS_TONES[row.code as AdminPaymentStatus],
  }));

  const mobilizedCount = data.workflowStageQueue.find((row) => row.code === 'mobilized')?.count ?? 0;
  const paidCount = data.paymentSummary.find((row) => row.code === 'paid')?.count ?? 0;
  const averageStageDurationDisplay =
    data.averageStageDurationDays == null
      ? '—'
      : `${formatNumber(data.averageStageDurationDays, language, { maximumFractionDigits: 1 })} ${t('adminDashboardDaysUnit')}`;
  const documentsUploadedConversion = data.conversionFunnel.find((row) => row.code === 'documents_uploaded');
  const verifiedConversion = data.conversionFunnel.find((row) => row.code === 'verified');
  const PaidIcon = PAYMENT_STATUS_ICON.paid;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardKeyMetricsTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardKeyMetricsSubtitle')}</p>
        <div className="flex flex-wrap gap-2">
          <StatTile
            value={data.candidateWorkload.totalActiveCandidates}
            label={t('adminDashboardTotalActiveCandidates')}
            className="bg-brand-subtle text-brand"
            icon={<Users />}
            trend={<Sparkline data={data.kpiTrends.activeCandidates} tone="brand" />}
          />
          <StatTile
            value={paidCount}
            label={t(ADMIN_PAYMENT_STATUS_KEYS.paid)}
            className={TONE_TILE_CLASSNAME.success}
            icon={<PaidIcon />}
            trend={<Sparkline data={data.kpiTrends.paidPayments} tone="success" />}
          />
          <StatTile
            value={mobilizedCount}
            label={stageLabel('mobilized', t)}
            className={TONE_TILE_CLASSNAME.info}
            icon={<Plane />}
            trend={<Sparkline data={data.kpiTrends.mobilized} tone="info" />}
          />
          <StatTile
            value={averageStageDurationDisplay}
            label={t('adminDashboardAverageStageDuration')}
            className={TONE_TILE_CLASSNAME.neutral}
            icon={<Timer />}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardRequiresAttentionTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardRequiresAttentionSubtitle')}</p>
        <RequiresAttentionPanel rows={data.requiresAttention} t={t} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardDocumentReviewQueueTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardDocumentReviewQueueSubtitle')}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <CategoryDonutChart data={documentReviewChartData} />
          <div className="flex flex-1 flex-wrap gap-2">
            {DOCUMENT_REVIEW_SUMMARY_ROWS.map((row) => {
              const style = DOCUMENT_REVIEW_ROW_STYLE[row.key];
              const Icon = style?.icon ?? Clock;
              return (
                <StatTile
                  key={row.key}
                  value={data.documentReviewQueue[row.key]}
                  label={t(row.labelKey as TranslationKey)}
                  className={TONE_TILE_CLASSNAME[style?.tone ?? 'neutral']}
                  icon={<Icon />}
                />
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardPaymentSummaryTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardPaymentSummarySubtitle')}</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <CategoryDonutChart data={paymentChartData} />
          <div className="flex flex-1 flex-wrap gap-2">
            {data.paymentSummary.map((row) => {
              const code = row.code as AdminPaymentStatus;
              const Icon = PAYMENT_STATUS_ICON[code] ?? Clock;
              return (
                <StatTile
                  key={row.code}
                  value={row.count}
                  label={t((ADMIN_PAYMENT_STATUS_KEYS[code] ?? 'candidateDocumentsStatusUnknown') as TranslationKey)}
                  className={TONE_TILE_CLASSNAME[ADMIN_PAYMENT_STATUS_TONES[code] ?? 'neutral']}
                  icon={<Icon />}
                />
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardPipelineTitle')}</h2>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardPipelineSubtitle')}</p>
        <WorkflowPipelineOverview workflowStageQueue={data.workflowStageQueue} t={t} />
        {documentsUploadedConversion || verifiedConversion ? (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border-default pt-3 text-sm">
            {documentsUploadedConversion ? (
              <span className="text-text-secondary">
                {t('adminDashboardDocumentCompletion')}:{' '}
                <span className="font-semibold text-text-primary">
                  {formatNumber(documentsUploadedConversion.percentage, language, { maximumFractionDigits: 1 })}%
                </span>
              </span>
            ) : null}
            {verifiedConversion ? (
              <span className="text-text-secondary">
                {t('adminDashboardVerificationConversion')}:{' '}
                <span className="font-semibold text-text-primary">
                  {formatNumber(verifiedConversion.percentage, language, { maximumFractionDigits: 1 })}%
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardUpcomingActivitiesTitle')}</h2>
          <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardUpcomingActivitiesSubtitle')}</p>
          <UpcomingActivitiesPanel rows={data.upcomingActivities} t={t} language={language} />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-text-primary">{t('adminDashboardRecentlyUpdatedTitle')}</h2>
          <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardRecentlyUpdatedSubtitle')}</p>
          <RecentlyUpdatedCandidatesTable rows={data.recentlyUpdatedCandidates} t={t} language={language} />
        </Card>
      </div>
    </div>
  );
}
