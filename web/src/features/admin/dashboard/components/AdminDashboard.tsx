import { useEffect } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Card, ErrorState, ForbiddenState, LoadingState, OfflineState, StatTile } from '../../../../design-system';
import { ADMIN_DASHBOARD_ERROR_KEYS } from '../../../../../../shared/adminDashboard/errorMessages';
import { DOCUMENT_REVIEW_SUMMARY_ROWS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import { ADMIN_PAYMENT_STATUS_KEYS } from '../../../../../../shared/adminPayments/paymentLabels';
import type { AdminPaymentStatus } from '../../../../lib/admin-payments-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { StatusSummaryTable, type TFn } from '../../reports/components/ReportTables';
import { useAdminDashboard } from '../hooks/useAdminDashboard';

/**
 * The Admin dashboard (MPS-801): candidate workload, workflow-stage queue,
 * document-review queue depth, and payment visibility. No RequireStaffAuth
 * permission prop -- gating happens via the query's own FORBIDDEN state,
 * same as PaymentTransactionList.tsx.
 */
export function AdminDashboard() {
  const { t } = useLanguage();
  const { signOut } = useStaffAuth();
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('adminDashboardTitle')}</h1>
        <p className="text-sm text-text-secondary">{t('adminDashboardSubtitle')}</p>
      </div>

      <DashboardContent query={query} t={t} />
    </div>
  );
}

function DashboardContent({ query, t }: { query: ReturnType<typeof useAdminDashboard>; t: TFn }) {
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('adminDashboardCandidateWorkloadTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <StatTile value={data.candidateWorkload.totalActiveCandidates} label={t('adminDashboardTotalActiveCandidates')} className="bg-[#E6F2FF] text-[#0066CC]" />
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('dashboardWorkflowStageQueueTitle')}</h2>
        <StatusSummaryTable rows={data.workflowStageQueue} t={t} />
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('adminDashboardDocumentReviewQueueTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_REVIEW_SUMMARY_ROWS.map((row) => (
            <StatTile
              key={row.key}
              value={data.documentReviewQueue[row.key]}
              label={t(row.labelKey as TranslationKey)}
              className="bg-[#F6F6F6] text-[#374151]"
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-text-primary">{t('adminDashboardPaymentSummaryTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {data.paymentSummary.map((row) => (
            <StatTile
              key={row.code}
              value={row.count}
              label={t((ADMIN_PAYMENT_STATUS_KEYS[row.code as AdminPaymentStatus] ?? 'candidateDocumentsStatusUnknown') as TranslationKey)}
              className="bg-[#F6F6F6] text-[#374151]"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
