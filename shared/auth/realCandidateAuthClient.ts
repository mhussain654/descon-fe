// Real CandidateAuthClient implementation (MPS-206), calling the MPS-201
// backend documented in descon-be's openapi.yaml:
//   POST /api/v1/candidate/auth/otp/request
//   POST /api/v1/candidate/auth/otp/verify
//
// There is no separate resend endpoint and no server-issued challenge id --
// both calls re-key off the CNIC itself, matching CandidateAuthClient's
// contract (see types.ts). Sessions are renewed without a new OTP through
//   POST /api/v1/candidate/auth/refresh
// (`refreshSession`); there is no candidate logout endpoint yet. The
// access/refresh tokens are stored by AuthContext on each platform.
import type { ApiClient, ApiError } from '../api-client';
import type { AuthError, AuthErrorCode, AuthSession, CandidateAuthClient, OtpChallenge } from './types';

interface CandidateOtpRequestResponse {
  expires_in_seconds: number;
  resend_after_seconds: number;
}

interface CandidateSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  session: { id: string };
  candidate: {
    id: string;
    full_name: string;
    preferred_locale: 'en' | 'ur';
    consent: {
      current_policy_version: string;
      accepted: boolean;
      accepted_at: string | null;
    };
  };
}

export interface RealCandidateAuthClientOptions {
  apiClient: ApiClient;
  /** Read fresh on every call so a language switch mid-flow is reflected immediately, per MPS-206: "Send the selected language through X-Locale for every request." */
  getLocale: () => 'en' | 'ur';
}

/** Maps the backend's ErrorItem.code (see openapi.yaml's otp/verify 401 examples) to the shared AuthErrorCode taxonomy. */
const SERVER_CODE_TO_AUTH_ERROR: Record<string, AuthErrorCode> = {
  otp_invalid: 'OTP_INVALID',
  otp_expired: 'OTP_EXPIRED',
  otp_max_attempts: 'OTP_MAX_ATTEMPTS',
  rate_limited: 'RATE_LIMITED',
};

function toAuthError(error: unknown): AuthError {
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) {
    return { code: 'UNKNOWN' };
  }

  // Already a well-formed AuthError (e.g. thrown directly by this file for
  // an empty/unexpected success body) -- shared/api-client.ts's ApiError
  // always carries `status`, so its absence here means this didn't come
  // from a fetch failure and needs no remapping.
  if (!('status' in apiError)) {
    return error as AuthError;
  }

  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.code === 'CANCELLED') return { code: 'UNKNOWN' };

  if (apiError.status === 429) {
    return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  }

  const mapped = apiError.serverCode ? SERVER_CODE_TO_AUTH_ERROR[apiError.serverCode] : undefined;
  if (mapped) return { code: mapped };

  // 422 (malformed CNIC/OTP shape) reaching here means client-side
  // validation let something through the server rejected -- fold it into
  // the same non-enumerating "couldn't process this" bucket as any other
  // unrecognized failure, never a distinct/revealing code.
  return { code: 'OTP_REQUEST_FAILED' };
}

/** Refresh failures: the server rejecting the token (401) or the account (403) ends the session; everything else is transient and must never log the candidate out. */
function toRefreshError(error: unknown): AuthError {
  const apiError = error as ApiError;
  if (apiError && typeof apiError === 'object' && 'status' in apiError) {
    if (apiError.status === 401 || apiError.status === 403) return { code: 'SESSION_EXPIRED' };
    if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
    if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
    if (apiError.status === 429) return { code: 'RATE_LIMITED', retryAfterSeconds: apiError.retryAfterSeconds };
  }
  return { code: 'UNKNOWN' };
}

function toSession(data: CandidateSessionResponse): AuthSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    candidateId: data.candidate.id,
    candidateName: data.candidate.full_name,
    preferredLocale: data.candidate.preferred_locale,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    consent: {
      currentPolicyVersion: data.candidate.consent.current_policy_version,
      accepted: data.candidate.consent.accepted,
      acceptedAt: data.candidate.consent.accepted_at,
    },
  };
}

function toOtpChallenge(data: CandidateOtpRequestResponse): OtpChallenge {
  return {
    expiresInSeconds: data.expires_in_seconds,
    resendAfterSeconds: data.resend_after_seconds,
    // The real backend does not send a masked destination -- see
    // OtpChallenge's doc comment. Left undefined; already optional-safe
    // everywhere it's rendered.
  };
}

export function createCandidateAuthClient(options: RealCandidateAuthClientOptions): CandidateAuthClient {
  const { apiClient, getLocale } = options;

  const headers = () => ({ 'X-Locale': getLocale() });

  async function requestOtp(cnic: string): Promise<OtpChallenge> {
    try {
      const data = await apiClient.post<CandidateOtpRequestResponse>(
        '/candidate/auth/otp/request',
        { candidate: { cnic } },
        { headers: headers() }
      );
      if (!data) throw { code: 'UNKNOWN' } satisfies AuthError;
      return toOtpChallenge(data);
    } catch (error) {
      throw toAuthError(error);
    }
  }

  return {
    requestOtp,
    // No separate resend endpoint on the real backend -- a repeat request
    // re-delivers within the same cooldown window (see RequestService).
    resendOtp: requestOtp,

    async verifyOtp(cnic: string, code: string): Promise<AuthSession> {
      try {
        const data = await apiClient.post<CandidateSessionResponse>(
          '/candidate/auth/otp/verify',
          { candidate: { cnic, otp: code } },
          { headers: headers() }
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AuthError;

        return toSession(data);
      } catch (error) {
        throw toAuthError(error);
      }
    },

    async refreshSession(refreshToken: string): Promise<AuthSession> {
      try {
        const data = await apiClient.post<CandidateSessionResponse>(
          '/candidate/auth/refresh',
          { candidate: { refresh_token: refreshToken } },
          { headers: headers() }
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies AuthError;
        return toSession(data);
      } catch (error) {
        throw toRefreshError(error);
      }
    },
  };
}
