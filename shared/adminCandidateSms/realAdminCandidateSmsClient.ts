// Real AdminCandidateSmsClient, calling the backend documented in descon-be's
// openapi.yaml (see ./types.ts). Authenticates through
// StaffAuthClient.authenticatedDataRequest so the POST's own 404/409/422 shapes
// reach the caller intact, like realAdminCandidateAiCallsClient.ts.
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type {
  AdminCandidateSmsClient,
  AdminCandidateSmsError,
  AdminCandidateSmsErrorCode,
  CandidateSmsDelivery,
  CandidateSmsOverview,
  SmsLocale,
} from './types';

interface DeliveryResponse {
  id: string;
  message_code: string;
  locale: SmsLocale;
  status: CandidateSmsDelivery['status'];
  error_code: string | null;
  sent_by: { id: string; role: string } | null;
  created_at: string;
  sent_at: string | null;
}

interface OverviewResponse {
  default_locale: SmsLocale;
  messages: {
    message_code: string;
    automatic: boolean;
    locales: SmsLocale[];
    variables: string[];
    prefilled: Partial<Record<SmsLocale, Record<string, string>>>;
  }[];
  deliveries: DeliveryResponse[];
}

export interface RealAdminCandidateSmsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => SmsLocale;
}

function toDelivery(data: DeliveryResponse): CandidateSmsDelivery {
  return {
    id: data.id,
    messageCode: data.message_code,
    locale: data.locale,
    status: data.status,
    errorCode: data.error_code ?? undefined,
    sentBy: data.sent_by ?? undefined,
    createdAt: data.created_at,
    sentAt: data.sent_at ?? undefined,
  };
}

function toOverview(data: OverviewResponse): CandidateSmsOverview {
  return {
    defaultLocale: data.default_locale,
    messages: data.messages.map((message) => ({
      messageCode: message.message_code,
      automatic: message.automatic,
      locales: message.locales,
      variables: message.variables,
      prefilled: message.prefilled ?? {},
    })),
    deliveries: data.deliveries.map(toDelivery),
  };
}

const SERVER_CODE_TO_ERROR: Partial<Record<string, AdminCandidateSmsErrorCode>> = {
  validation_failed: 'VALIDATION_FAILED',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  idempotency_in_progress: 'RATE_LIMITED',
  inactive_account: 'INACTIVE_ACCOUNT',
};

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

export function toAdminCandidateSmsError(error: unknown): AdminCandidateSmsError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE') return { code: error.code };
    return { code: 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message, field: apiError.field };
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 409) return { code: 'IDEMPOTENCY_CONFLICT', message: apiError.message };
  if (apiError.status === 422) return { code: 'VALIDATION_FAILED', message: apiError.message, field: apiError.field };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', message: apiError.message };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createAdminCandidateSmsClient(options: RealAdminCandidateSmsClientOptions): AdminCandidateSmsClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const path = (candidateId: string) => `/admin/candidates/${encodeURIComponent(candidateId)}/sms_messages`;

  return {
    async getOverview(candidateId) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<OverviewResponse>(path(candidateId), { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale() } })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminCandidateSmsError;
        return toOverview(data);
      } catch (error) {
        throw toAdminCandidateSmsError(error);
      }
    },

    async send(candidateId, input, idempotencyKey) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<DeliveryResponse>(
            path(candidateId),
            { sms_message: { message_code: input.messageCode, locale: input.locale, variables: input.variables } },
            { headers: { Authorization: `Bearer ${token}`, 'X-Locale': getLocale(), 'Idempotency-Key': idempotencyKey } }
          )
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AdminCandidateSmsError;
        return toDelivery(data);
      } catch (error) {
        throw toAdminCandidateSmsError(error);
      }
    },
  };
}
