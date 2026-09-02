// Mobile configuration for the candidate KuickPay payment client (mirrors
// web/src/lib/payments-client.ts exactly). Wires the real backend
// (shared/payments/realPaymentsClient.ts).
import { createPaymentsClient } from '../../../shared/payments/realPaymentsClient';
import type {
  InitiateCheckoutResult,
  Payment,
  PaymentBlockingReason,
  PaymentEligibility,
  PaymentError,
  PaymentErrorCode,
  PaymentsClient,
  PaymentStatus,
} from '../../../shared/payments/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type {
  InitiateCheckoutResult,
  Payment,
  PaymentBlockingReason,
  PaymentEligibility,
  PaymentError,
  PaymentErrorCode,
  PaymentsClient,
  PaymentStatus,
};

export const paymentsClient: PaymentsClient = createPaymentsClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});
