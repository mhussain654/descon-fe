import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, EmptyState, ErrorState, ForbiddenState, LoadingState, OfflineState } from '../../../../design-system';
import { formatCurrency, formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_PAYMENT_ERROR_KEYS } from '../../../../../../shared/adminPayments/errorMessages';
import {
  ADMIN_PAYMENT_STATUS_KEYS,
  ADMIN_PAYMENT_STATUS_TONES,
  RECONCILIATION_STATE_KEYS,
  RECONCILIATION_STATE_TONES,
} from '../../../../../../shared/adminPayments/paymentLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { ReconciliationFinding, ReconciliationFindingCode } from '../../../../lib/admin-payments-client';
import { usePaymentDetail } from '../hooks/usePaymentDetail';
import { PaymentCorrectionForm } from './PaymentCorrectionForm';
import { PaymentEventTimeline } from './PaymentEventTimeline';
import { ReconciliationFindingsSection } from './ReconciliationFindingsSection';

export interface PaymentDetailProps {
  paymentId: string;
}

interface ActiveCorrection {
  findingId?: string;
  findingCode?: ReconciliationFindingCode;
}

/**
 * The payment detail workspace (ticket: "Payment detail workspace") -- the
 * sole source of truth for one payment, composing its header facts,
 * reconciliation findings and event timeline, plus the permission-gated
 * correction form. Never displays raw callbacks, provider secrets,
 * signatures or full CNIC/mobile values -- everything rendered here already
 * came from PaymentDetailSerializer's own safe field set.
 */
export function PaymentDetail({ paymentId }: PaymentDetailProps) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const query = usePaymentDetail(paymentId);
  const [activeCorrection, setActiveCorrection] = useState<ActiveCorrection | null>(null);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') {
      signOut('expired');
    } else if (query.error?.code === 'INACTIVE_ACCOUNT') {
      signOut('manual');
    }
  }, [query.error, signOut]);

  if (query.isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (query.error?.code === 'SESSION_EXPIRED' || query.error?.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (query.error?.code === 'FORBIDDEN') {
    return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
  }

  if (query.error?.code === 'NOT_FOUND') {
    return <EmptyState title={t('adminFinancePaymentNotFoundTitle')} description={t('adminFinancePaymentNotFoundDescription')} />;
  }

  if (query.error?.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
    );
  }

  if (query.error && !query.data) {
    const key = ADMIN_PAYMENT_ERROR_KEYS[query.error.code] as TranslationKey;
    return <ErrorState message={query.error.message || t(key)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  if (!query.data) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const payment = query.data;
  const canCorrect = hasPermission('manage_payments');

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <Link to="/admin/finance/payments" className="inline-block text-sm font-medium text-brand hover:underline">
        {t('adminFinancePaymentBackToList')}
      </Link>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-text-primary">{t('adminFinancePaymentDetailTitle')}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge tone={ADMIN_PAYMENT_STATUS_TONES[payment.status]}>{t(ADMIN_PAYMENT_STATUS_KEYS[payment.status])}</Badge>
            <Badge tone={RECONCILIATION_STATE_TONES[payment.reconciliationState]}>
              {t(RECONCILIATION_STATE_KEYS[payment.reconciliationState])}
            </Badge>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentCandidateLabel')}</dt>
            <dd className="text-sm text-text-primary">{payment.candidate.fullName}</dd>
            <dd className="text-xs text-text-tertiary" dir="ltr">
              {payment.candidate.maskedCnic}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentReferenceLabel')}</dt>
            <dd className="text-sm text-text-primary">{payment.candidate.referenceNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentAmountLabel')}</dt>
            <dd className="text-sm text-text-primary" dir="ltr">
              {formatCurrency(Number(payment.amount), language, payment.currencyCode)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentTypeLabel')}</dt>
            <dd className="text-sm text-text-primary">{payment.paymentTypeCode}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentProviderLabel')}</dt>
            <dd className="text-sm text-text-primary">{payment.provider}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentExternalReferenceLabel')}</dt>
            <dd className="text-sm text-text-primary">{payment.externalReference || t('adminFinancePaymentExternalReferenceNotSet')}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentSubmittedOnLabel')}</dt>
            <dd className="text-sm text-text-primary" dir="ltr">
              {formatDate(payment.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
            </dd>
          </div>
          {payment.paidAt ? (
            <div>
              <dt className="text-xs text-text-tertiary">{t('adminFinancePaymentPaidOnLabel')}</dt>
              <dd className="text-sm text-text-primary" dir="ltr">
                {formatDate(payment.paidAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <ReconciliationFindingsSection
        findings={payment.reconciliationFindings}
        canCorrect={canCorrect}
        onInvestigate={(finding: ReconciliationFinding) =>
          setActiveCorrection({ findingId: finding.id, findingCode: finding.findingCode })
        }
      />

      <PaymentEventTimeline events={payment.paymentEvents} />

      {canCorrect && !activeCorrection ? (
        <Button type="button" variant="primary" onClick={() => setActiveCorrection({})}>
          {t('adminFinancePaymentCorrectAction')}
        </Button>
      ) : null}

      {activeCorrection ? (
        <PaymentCorrectionForm
          payment={payment}
          findingId={activeCorrection.findingId}
          findingCode={activeCorrection.findingCode}
          onDone={() => setActiveCorrection(null)}
          onCancel={() => setActiveCorrection(null)}
        />
      ) : null}
    </div>
  );
}
