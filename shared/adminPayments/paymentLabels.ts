// Pure label/tone lookups for the admin finance payment workspace,
// mirroring shared/payments/statusLabels.ts's identical pattern.
import type { AdminPaymentStatus, PaymentReconciliationState, ReconciliationFindingCode } from './types';
import type { TranslationKey } from '../i18n/translations';

export const ADMIN_PAYMENT_STATUS_KEYS: Record<AdminPaymentStatus, TranslationKey> = {
  checkout_pending: 'adminFinancePaymentStatusCheckoutPending',
  paid: 'adminFinancePaymentStatusPaid',
  failed: 'adminFinancePaymentStatusFailed',
  cancelled: 'adminFinancePaymentStatusCancelled',
};

export const ADMIN_PAYMENT_STATUS_TONES: Record<AdminPaymentStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  checkout_pending: 'warning',
  paid: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

export const RECONCILIATION_STATE_KEYS: Record<PaymentReconciliationState, TranslationKey> = {
  clean: 'adminFinancePaymentReconciliationClean',
  open: 'adminFinancePaymentReconciliationOpen',
  resolved: 'adminFinancePaymentReconciliationResolved',
};

export const RECONCILIATION_STATE_TONES: Record<PaymentReconciliationState, 'success' | 'warning' | 'neutral'> = {
  clean: 'success',
  open: 'warning',
  resolved: 'neutral',
};

export const RECONCILIATION_FINDING_CODE_KEYS: Record<ReconciliationFindingCode, TranslationKey> = {
  paid_at_missing: 'adminFinancePaymentFindingPaidAtMissing',
  external_reference_missing: 'adminFinancePaymentFindingExternalReferenceMissing',
  duplicate_external_reference: 'adminFinancePaymentFindingDuplicateExternalReference',
  workflow_payment_mismatch: 'adminFinancePaymentFindingWorkflowPaymentMismatch',
  terminal_event_conflict: 'adminFinancePaymentFindingTerminalEventConflict',
};

/** Known event_type values actually produced today (Payments::NotificationEventRecorder, Admin::Payments::CorrectionService) -- event_type/event_source are otherwise free-form on the backend (validated only by a lowercase-snake-case regex), so anything not in this map falls back to a plain humanized version of the raw code rather than crashing or showing a raw translation-key string. */
const KNOWN_EVENT_TYPE_KEYS: Partial<Record<string, TranslationKey>> = {
  payment_succeeded: 'adminFinancePaymentEventTypeSucceeded',
  payment_cancelled: 'adminFinancePaymentEventTypeCancelled',
  payment_failed: 'adminFinancePaymentEventTypeFailed',
  payment_corrected: 'adminFinancePaymentEventTypeCorrected',
};

const KNOWN_EVENT_SOURCE_KEYS: Partial<Record<string, TranslationKey>> = {
  callback: 'adminFinancePaymentEventSourceCallback',
  return: 'adminFinancePaymentEventSourceReturn',
  admin_correction: 'adminFinancePaymentEventSourceAdminCorrection',
};

function humanize(code: string): string {
  return code
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function paymentEventTypeLabel(eventType: string, t: (key: TranslationKey) => string): string {
  const key = KNOWN_EVENT_TYPE_KEYS[eventType];
  return key ? t(key) : humanize(eventType);
}

export function paymentEventSourceLabel(eventSource: string, t: (key: TranslationKey) => string): string {
  const key = KNOWN_EVENT_SOURCE_KEYS[eventSource];
  return key ? t(key) : humanize(eventSource);
}
