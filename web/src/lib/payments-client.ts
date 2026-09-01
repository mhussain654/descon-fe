// Web configuration for the candidate KuickPay payment client, wired to
// the real backend (shared/payments/realPaymentsClient.ts). Mirrors
// application-progress-client.ts's locale-reading convention exactly.
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

const LANGUAGE_STORAGE_KEY = 'descon.language';

/** Reads the same persisted key LanguageContext.tsx itself reads/writes -- see application-progress-client.ts's identical helper. */
function getLocale(): 'en' | 'ur' {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ur' ? 'ur' : 'en';
}

export const paymentsClient: PaymentsClient = createPaymentsClient({ apiClient, getLocale });
