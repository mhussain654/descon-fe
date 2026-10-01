// Shared metadata for the 4 requires_attention codes -- used by both
// RequiresAttentionPanel (the full list) and OperationalInsightBanner
// (which highlights the single largest one), so the label/hint/link for a
// given code is defined exactly once.
import { AlertTriangle, Ban, PhoneMissed, XCircle } from 'lucide-react';
import type { RequiresAttentionCode } from '../../../../../shared/adminDashboard/types';
import type { TranslationKey } from '../../../../../shared/i18n/translations';

export const ATTENTION_LABEL_KEYS: Record<RequiresAttentionCode, TranslationKey> = {
  rejected_documents: 'adminDashboardAttentionRejectedDocuments',
  failed_payment: 'adminDashboardAttentionFailedPayments',
  overdue_qvc: 'adminDashboardAttentionOverdueQvc',
  callback_required: 'adminDashboardAttentionCallbackRequired',
};

/** A one-line "what to do about it" hint, shown under the count in RequiresAttentionPanel and reused verbatim by OperationalInsightBanner. */
export const ATTENTION_HINT_KEYS: Record<RequiresAttentionCode, TranslationKey> = {
  rejected_documents: 'adminDashboardAttentionHintRejectedDocuments',
  failed_payment: 'adminDashboardAttentionHintFailedPayment',
  overdue_qvc: 'adminDashboardAttentionHintOverdueQvc',
  callback_required: 'adminDashboardAttentionHintCallbackRequired',
};

export const ATTENTION_ICON: Record<RequiresAttentionCode, typeof AlertTriangle> = {
  rejected_documents: XCircle,
  failed_payment: Ban,
  overdue_qvc: AlertTriangle,
  callback_required: PhoneMissed,
};

/**
 * Where clicking through actually goes -- only set for a code with a real,
 * honest target page today. `overdue_qvc` has no dedicated QVC list page in
 * the admin portal yet, so it stays a plain, unlinked count rather than
 * pointing somewhere that doesn't filter to it.
 */
export const ATTENTION_LINK_PATH: Record<RequiresAttentionCode, string | undefined> = {
  rejected_documents: '/admin/document-reviews?status=rejected',
  failed_payment: '/admin/finance/payments?status=failed',
  overdue_qvc: undefined,
  callback_required: '/admin/communications?channel=ai_voice_call',
};
