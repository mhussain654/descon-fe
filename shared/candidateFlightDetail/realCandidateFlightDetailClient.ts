// Real CandidateFlightDetailClient implementation (MPS-507/MPS-F502),
// calling the backend documented in descon-be's openapi.yaml:
//   GET  /api/v1/candidate/flight_detail
//   POST /api/v1/candidate/flight_detail/ticket_access
//
// accessToken is passed in per call (not read from a wrapped auth client),
// matching every other candidate-facing real client's identical convention.
import type { ApiClient, ApiError } from '../api-client';
import type {
  CandidateFlightDetail,
  CandidateFlightDetailClient,
  CandidateFlightDetailError,
  CandidateFlightDetailErrorCode,
  FlightTicketAccess,
} from './types';

interface FlightDetailResponse {
  id: string;
  airline: string;
  flight_number: string;
  sector: string;
  flight_departure_at: string;
  ticket_attached: boolean;
  mobilized_on: string | null;
  mobilized: boolean;
}

interface FlightTicketAccessResponse {
  flight_detail_id: string;
  url: string;
  expires_at: string;
}

export interface RealCandidateFlightDetailClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch is reflected immediately -- the backend localizes response messages per this header. */
  getLocale: () => 'en' | 'ur';
}

function toFlightDetail(data: FlightDetailResponse): CandidateFlightDetail {
  return {
    id: data.id,
    airline: data.airline,
    flightNumber: data.flight_number,
    sector: data.sector,
    flightDepartureAt: data.flight_departure_at,
    ticketAttached: data.ticket_attached,
    mobilizedOn: data.mobilized_on,
    mobilized: data.mobilized,
  };
}

function toAccess(data: FlightTicketAccessResponse): FlightTicketAccess {
  return { flightDetailId: data.flight_detail_id, url: data.url, expiresAt: data.expires_at };
}

/** Maps the backend's ErrorItem.code to the shared error taxonomy. */
const SERVER_CODE_TO_ERROR: Record<string, CandidateFlightDetailErrorCode> = {
  inactive_account: 'INACTIVE_ACCOUNT',
  not_found: 'NOT_FOUND',
  document_attachment_missing: 'TICKET_NOT_ATTACHED',
};

function toFlightDetailError(error: unknown): CandidateFlightDetailError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 401) return { code: 'SESSION_EXPIRED' };

  const mapped = apiError.serverCode ? SERVER_CODE_TO_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped, message: apiError.message };

  if (apiError.status === 403) return { code: 'INACTIVE_ACCOUNT' };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  if (apiError.status >= 500) return { code: 'SERVER_ERROR' };

  return { code: 'UNKNOWN', message: apiError.message };
}

export function createCandidateFlightDetailClient(options: RealCandidateFlightDetailClientOptions): CandidateFlightDetailClient {
  const { apiClient, getLocale } = options;

  return {
    async getFlightDetail(accessToken: string): Promise<CandidateFlightDetail | null> {
      try {
        const data = await apiClient.get<FlightDetailResponse | null>('/candidate/flight_detail', {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        return data ? toFlightDetail(data) : null;
      } catch (error) {
        throw toFlightDetailError(error);
      }
    },

    async requestTicketAccess(accessToken: string): Promise<FlightTicketAccess> {
      try {
        const data = await apiClient.post<FlightTicketAccessResponse>('/candidate/flight_detail/ticket_access', undefined, {
          headers: { Authorization: `Bearer ${accessToken}`, 'X-Locale': getLocale() },
        });
        if (!data) throw { code: 'UNKNOWN' } satisfies CandidateFlightDetailError;
        return toAccess(data);
      } catch (error) {
        throw toFlightDetailError(error);
      }
    },
  };
}
