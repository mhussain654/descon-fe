// In-memory mock implementation of CandidateAuthClient (MPS-F201). Used only
// in local dev/tests now that the real MPS-201/MPS-206 backend exists (see
// realCandidateAuthClient.ts) -- kept because it lets a screen be exercised
// without a running Rails server, and every existing test still targets it
// directly.
import type { AuthError, AuthSession, CandidateAuthClient, OtpChallenge } from './types';

/** The only code that verifies successfully in the mock. Real verification never works this way -- this is a documented dev/test convenience. */
export const MOCK_VALID_OTP = '123456';
/** A reserved CNIC that makes `requestOtp` fail generically, for exercising the non-enumerating-failure UI path. Real CNIC existence is never distinguishable through the client's behavior otherwise. */
export const MOCK_REQUEST_FAILURE_CNIC = '0000000000000';
export const MOCK_MAX_ATTEMPTS = 3;
export const MOCK_EXPIRES_IN_SECONDS = 120;
export const MOCK_RESEND_AFTER_SECONDS = 30;

interface MockChallenge {
  code: string;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
}

export interface MockCandidateAuthClientOptions {
  /** Returns whether the device currently has connectivity. Defaults to always-online, matching shared/api-client.ts's `isOnline` convention. */
  isOnline?: () => boolean;
  /** Simulated network latency in ms. Set to 0 in tests. */
  delayMs?: number;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Deterministic, fake mask -- for the mock only. A real server would send its own masked text (AGENTS.md: "use only server-provided masked text"). */
function mockMaskedDestination(cnic: string): string {
  return `••• ••• ••${cnic.slice(-2)}`;
}

export function createMockCandidateAuthClient(options: MockCandidateAuthClientOptions = {}): CandidateAuthClient {
  const { isOnline = () => true, delayMs = 500 } = options;
  // Keyed by CNIC, matching the real backend (request/verify both re-key off
  // the CNIC itself -- there is no server-issued challenge id).
  const challenges = new Map<string, MockChallenge>();

  const wait = () => (delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());
  const requireOnline = () => {
    if (!isOnline()) throw { code: 'OFFLINE' } satisfies AuthError;
  };

  return {
    async requestOtp(cnic) {
      await wait();
      requireOnline();

      if (cnic === MOCK_REQUEST_FAILURE_CNIC) {
        throw { code: 'OTP_REQUEST_FAILED' } satisfies AuthError;
      }

      const now = Date.now();
      challenges.set(cnic, {
        code: MOCK_VALID_OTP,
        createdAt: now,
        expiresAt: now + MOCK_EXPIRES_IN_SECONDS * 1000,
        resendAvailableAt: now + MOCK_RESEND_AFTER_SECONDS * 1000,
        attempts: 0,
      });

      return {
        expiresInSeconds: MOCK_EXPIRES_IN_SECONDS,
        resendAfterSeconds: MOCK_RESEND_AFTER_SECONDS,
        maskedDestination: mockMaskedDestination(cnic),
      } satisfies OtpChallenge;
    },

    async resendOtp(cnic) {
      await wait();
      requireOnline();

      const challenge = challenges.get(cnic);
      if (!challenge) throw { code: 'CHALLENGE_NOT_FOUND' } satisfies AuthError;

      const now = Date.now();
      if (now < challenge.resendAvailableAt) {
        throw {
          code: 'RESEND_COOLDOWN',
          retryAfterSeconds: Math.ceil((challenge.resendAvailableAt - now) / 1000),
        } satisfies AuthError;
      }

      // A fresh code resets the expiry, resend window and attempt count --
      // mirrors typical OTP provider behavior.
      challenge.code = MOCK_VALID_OTP;
      challenge.expiresAt = now + MOCK_EXPIRES_IN_SECONDS * 1000;
      challenge.resendAvailableAt = now + MOCK_RESEND_AFTER_SECONDS * 1000;
      challenge.attempts = 0;

      return {
        expiresInSeconds: MOCK_EXPIRES_IN_SECONDS,
        resendAfterSeconds: MOCK_RESEND_AFTER_SECONDS,
        maskedDestination: mockMaskedDestination(cnic),
      } satisfies OtpChallenge;
    },

    async verifyOtp(cnic, code) {
      await wait();
      requireOnline();

      const challenge = challenges.get(cnic);
      if (!challenge) throw { code: 'CHALLENGE_NOT_FOUND' } satisfies AuthError;

      if (Date.now() >= challenge.expiresAt) {
        throw { code: 'OTP_EXPIRED' } satisfies AuthError;
      }
      if (challenge.attempts >= MOCK_MAX_ATTEMPTS) {
        throw { code: 'OTP_MAX_ATTEMPTS' } satisfies AuthError;
      }

      if (code !== challenge.code) {
        challenge.attempts += 1;
        if (challenge.attempts >= MOCK_MAX_ATTEMPTS) {
          throw { code: 'OTP_MAX_ATTEMPTS' } satisfies AuthError;
        }
        throw { code: 'OTP_INVALID' } satisfies AuthError;
      }

      challenges.delete(cnic);
      return {
        accessToken: `mock_${randomId()}`,
        refreshToken: `mock_refresh_${randomId()}`,
        candidateId: `candidate_${cnic}`,
        candidateName: 'Mock Candidate',
        preferredLocale: 'en',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } satisfies AuthSession;
    },
  };
}

/**
 * Safe fallback for any build where the mock must not be reachable (i.e.
 * production, until a real implementation is wired in for that platform)
 * but no real implementation is active. Every call fails the same way the
 * generic, non-enumerating "couldn't send a code" failure already renders --
 * it never accepts the mock's well-known OTP and never fabricates a session.
 */
export function createUnavailableCandidateAuthClient(): CandidateAuthClient {
  const fail = (): Promise<never> => Promise.reject({ code: 'SERVICE_UNAVAILABLE' } satisfies AuthError);
  return {
    requestOtp: fail,
    resendOtp: fail,
    verifyOtp: fail,
  };
}
