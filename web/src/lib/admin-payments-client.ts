// Web configuration for the admin finance payments client, wired to the
// real backend (shared/adminPayments/realAdminPaymentsClient.ts).
// Admin-only, web-only (AGENTS.md: "administrative workflows remain
// web-focused") -- there is no mobile equivalent of this file.
import { createAdminPaymentsClient } from '../../../shared/adminPayments/realAdminPaymentsClient';
import type {
  AdminPaymentError,
  AdminPaymentErrorCode,
  AdminPaymentsClient,
  AdminPaymentStatus,
  PaymentActorRef,
  PaymentCandidateRef,
  PaymentCorrectionField,
  PaymentCorrectionRequest,
  PaymentDetail,
  PaymentEvent,
  PaymentListFilters,
  PaymentListPage,
  PaymentListPagination,
  PaymentListResult,
  PaymentListSort,
  PaymentReconciliationState,
  PaymentSummary,
  ReconciliationFinding,
  ReconciliationFindingCode,
  ReconciliationFindingState,
} from '../../../shared/adminPayments/types';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';

export type {
  AdminPaymentError,
  AdminPaymentErrorCode,
  AdminPaymentsClient,
  AdminPaymentStatus,
  PaymentActorRef,
  PaymentCandidateRef,
  PaymentCorrectionField,
  PaymentCorrectionRequest,
  PaymentDetail,
  PaymentEvent,
  PaymentListFilters,
  PaymentListPage,
  PaymentListPagination,
  PaymentListResult,
  PaymentListSort,
  PaymentReconciliationState,
  PaymentSummary,
  ReconciliationFinding,
  ReconciliationFindingCode,
  ReconciliationFindingState,
};

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see candidate-import-client.ts's identical helper. The backend localizes response messages from this header. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const adminPaymentsClient: AdminPaymentsClient = createAdminPaymentsClient({
  apiClient,
  staffAuthClient,
  getLocale,
});
