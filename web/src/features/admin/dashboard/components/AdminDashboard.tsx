import { useCallback, useEffect } from 'react';
import { Clock, Plane, Timer, Users } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, StatTile } from '../../../../design-system';
import { ADMIN_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminDashboard/errorMessages';
import { DOCUMENT_REVIEW_SUMMARY_ROWS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import { ADMIN_PAYMENT_STATUS_KEYS, ADMIN_PAYMENT_STATUS_TONES } from '../../../../../../shared/adminPayments/paymentLabels';
import type { AdminPaymentStatus } from '../../../../lib/admin-payments-client';
import type { AdminDashboardFilters } from '../../../../lib/admin-dashboard-client';
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
import { OperationalInsightBanner } from './OperationalInsightBanner';
import { DashboardFilterBar } from './DashboardFilterBar';
import { readDashboardFiltersFromSearchParams, writeDashboardFiltersToSearchParams } from '../adminDashboardUrlState';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readDashboardFiltersFromSearchParams(searchParams);
  const query = useAdminDashboard(filters);

  const updateFilters = useCallback(
    (patch: Partial<AdminDashboardFilters>) => {
      setSearchParams(writeDashboardFiltersToSearchParams({ ...filters, ...patch }));
    },
    [filters, setSearchParams]
  );

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      {/* Solid brand blue, not a gradient -- this is a compliance/ops tool
          (visa, medical, government-BU workflows), not a consumer app, so
          the banner stays in the app's existing brand color rather than
          reaching for a decorative multi-color wash. */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminDashboardKeyMetricsTitle')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminDashboardTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-white/80">{t('adminDashboardSubtitle')}</p>
          </div>
          {hasPermission('manage_candidates') ? (
            <Link
              to="/admin/candidates/new"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand"
            >
              {t('adminAddCandidate')}
            </Link>
          ) : null}
        </div>
      </div>

      <DashboardFilterBar filters={filters} onChange={updateFilters} t={t} />

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
    <div className="flex flex-col gap-5">
      <OperationalInsightBanner data={data} t={t} language={language} />

      <section aria-labelledby="dashboard-key-metrics">
        <div className="mb-3">
          <h2 id="dashboard-key-metrics" className="text-base font-semibold text-text-primary">{t('adminDashboardKeyMetricsTitle')}</h2>
          <p className="text-xs text-text-secondary">{t('adminDashboardKeyMetricsSubtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
          <StatTile
            value={data.candidateWorkload.totalActiveCandidates}
            label={t('adminDashboardTotalActiveCandidates')}
            className="min-w-0 overflow-hidden border-border border-t-4 border-t-brand bg-surface-raised text-brand shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            icon={<Users />}
            trend={<Sparkline data={data.kpiTrends.activeCandidates} tone="brand" />}
          />
          <StatTile
            value={paidCount}
            label={t(ADMIN_PAYMENT_STATUS_KEYS.paid)}
            className="min-w-0 overflow-hidden border-border border-t-4 border-t-success bg-surface-raised text-success-emphasis shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            icon={<PaidIcon />}
            trend={<Sparkline data={data.kpiTrends.paidPayments} tone="success" />}
          />
          <StatTile
            value={mobilizedCount}
            label={stageLabel('mobilized', t)}
            className="min-w-0 overflow-hidden border-border border-t-4 border-t-info bg-surface-raised text-info-emphasis shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            icon={<Plane />}
            trend={<Sparkline data={data.kpiTrends.mobilized} tone="info" />}
          />
          <StatTile
            value={averageStageDurationDisplay}
            label={t('adminDashboardAverageStageDuration')}
            className="min-w-0 overflow-hidden border-border border-t-4 border-t-warning bg-surface-raised text-warning-emphasis shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            icon={<Timer />}
          />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.65fr)]">
        <Card className="shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardPipelineTitle')}</h2>
          <p className="mb-4 text-xs text-text-secondary">{t('adminDashboardPipelineSubtitle')}</p>
          <WorkflowPipelineOverview workflowStageQueue={data.workflowStageQueue} t={t} />
          {documentsUploadedConversion || verifiedConversion ? (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm">
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

        <Card className="border-danger/10 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardRequiresAttentionTitle')}</h2>
          <p className="mb-3 text-xs text-text-secondary">{t('adminDashboardRequiresAttentionSubtitle')}</p>
          <RequiresAttentionPanel rows={data.requiresAttention} t={t} />
        </Card>
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(300px,0.82fr)]">
        <Card className="min-w-0 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardDocumentReviewQueueTitle')}</h2>
            <Link to="/admin/document-reviews" className="text-sm font-medium text-brand hover:underline">
              {t('adminDashboardReviewQueueLink')}
            </Link>
          </div>
          <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardDocumentReviewQueueSubtitle')}</p>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <CategoryDonutChart data={documentReviewChartData} />
            <div className="grid w-full flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
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

        <Card className="min-w-0 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardPaymentSummaryTitle')}</h2>
            <Link to="/admin/finance/payments" className="text-sm font-medium text-brand hover:underline">
              {t('adminDashboardTransactionsLink')}
            </Link>
          </div>
          <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardPaymentSummarySubtitle')}</p>
          <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
            <CategoryDonutChart data={paymentChartData} />
            <div className="grid w-full flex-1 grid-cols-2 gap-2">
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

        <Card className="min-w-0 shadow-sm">
          <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardUpcomingActivitiesTitle')}</h2>
          <p className="mb-3 text-xs text-text-secondary">{t('adminDashboardUpcomingActivitiesSubtitle')}</p>
          <UpcomingActivitiesPanel rows={data.upcomingActivities} t={t} language={language} />
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden shadow-sm [&_tbody_tr:nth-child(even)]:bg-surface-sunken/45 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-brand-subtle/40">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">{t('adminDashboardRecentlyUpdatedTitle')}</h2>
          <Link to="/admin" className="text-sm font-medium text-brand hover:underline">
            {t('adminDashboardViewAllCandidatesLink')}
          </Link>
        </div>
        <p className="mb-2 text-xs text-text-secondary">{t('adminDashboardRecentlyUpdatedSubtitle')}</p>
        <RecentlyUpdatedCandidatesTable rows={data.recentlyUpdatedCandidates} t={t} language={language} />
      </Card>
    </div>
  );
}
