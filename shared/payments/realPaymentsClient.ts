// Real PaymentsClient implementation, calling the backend documented in
// descon-be's openapi.yaml:
//   GET  /api/v1/candidate/payment
//   POST /api/v1/candidate/payment
import type { ApiClient, ApiError } from '../api-client';
import { toBlockingReasons, toPayment, toPaymentEligibility, type EligibilityResponse, type PaymentResponse } from './mapEligibilityResponse';
import type { InitiateCheckoutResult, PaymentBlockingReason, PaymentEligibility, PaymentError, PaymentErrorCode, PaymentsClient } from './types';

interface InitiateCheckoutResponse {
  eligibility: EligibilityResponse;
  payment: PaymentResponse;
}

export interface RealPaymentsClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes messages per this header. */
  getLocale: () => 'en' | 'ur';
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's /candidate/payment 422/503 examples) to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, PaymentErrorCode> = {
  payment_not_eligible: 'NOT_ELIGIBLE',
  payment_checkout_unavailable: 'CHECKOUT_UNAVAILABLE',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  missing_idempotency_key: 'MISSING_IDEMPOTENCY_KEY',
  invalid_idempotency_key: 'INVALID_IDEMPOTENCY_KEY',
  idempotency_in_progress: 'IDEMPOTENCY_IN_PROGRESS',
  inactive_account: 'INACTIVE_ACCOUNT',
};

/** The first error item's own `details.blocking_reasons` (see openapi.yaml's `notEligible` 422 example) -- never `ApiError.details`, which holds the whole raw envelope. */
function blockingReasonsFromFirstError(apiError: ApiError): PaymentBlockingReason[] | undefined {
  const first = apiError.errors?.[0] as { details?: { blocking_reasons?: unknown } } | undefined;
  const blockingReasons = first?.details?.blocking_reasons;
  if (!Array.isArray(blockingReasons)) return undefined;
  return toBlockingReasons(blockingReasons);
}

function toPaymentError(error: unknown): PaymentError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped === 'NOT_ELIGIBLE') {
    return { code: mapped, message: apiError.message, blockingReasons: blockingReasonsFromFirstError(apiError) };
  }
  if (mapped) return { code: mapped, message: apiError.message };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status === 503) return { code: 'CHECKOUT_UNAVAILABLE', message: apiError.message };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createPaymentsClient(options: RealPaymentsClientOptions): PaymentsClient {
  const { apiClient, getLocale } = options;

  return {
    async getEligibility(accessToken: string): Promise<PaymentEligibility> {
      try {
        const data = await apiClient.get<EligibilityResponse>('/candidate/payment', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return toPaymentEligibility(data);
      } catch (error) {
        throw toPaymentError(error);
      }
    },

    async initiateCheckout(accessToken: string, idempotencyKey: string): Promise<InitiateCheckoutResult> {
      let data: InitiateCheckoutResponse;
      try {
        // The request body is always empty -- the backend controls amount,
        // currency, provider, and order reference entirely; there is
        // nothing for the candidate to submit.
        data = await apiClient.post<InitiateCheckoutResponse>('/candidate/payment', undefined, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Locale': getLocale(),
            'Idempotency-Key': idempotencyKey,
          },
        });
      } catch (error) {
        throw toPaymentError(error);
      }

      const payment = toPayment(data.payment);
      if (!payment) throw { code: 'UNKNOWN' } satisfies PaymentError;
      return { eligibility: toPaymentEligibility(data.eligibility), payment };
    },
  };
}
