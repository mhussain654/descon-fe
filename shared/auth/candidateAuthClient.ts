// In-memory mock implementation of CandidateAuthClient (MPS-F201). Stands in
// for the not-yet-built MPS-201 API during UI development. Swapping to the
// real backend later means writing one new class implementing
// `CandidateAuthClient` (calling shared/api-client.ts like every other
// feature) and changing the single call site that constructs the client --
// no screen, hook or reducer changes.
import type { AuthError, AuthSession, CandidateAuthClient, OtpChallenge } from './types';

/** The only code that verifies successfully in the mock. Real verification never works this way -- this is a documented dev/test convenience. */
export const MOCK_VALID_OTP = '123456';
/** A reserved CNIC that makes `requestOtp` fail generically, for exercising the non-enumerating-failure UI path. Real CNIC existence is never distinguishable through the client's behavior otherwise. */
export const MOCK_REQUEST_FAILURE_CNIC = '0000000000000';
export const MOCK_MAX_ATTEMPTS = 3;
export const MOCK_EXPIRES_IN_SECONDS = 120;
export const MOCK_RESEND_AFTER_SECONDS = 30;

interface MockChallenge {
  cnic: string;
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
      const challengeId = randomId();
      challenges.set(challengeId, {
        cnic,
        code: MOCK_VALID_OTP,
        createdAt: now,
        expiresAt: now + MOCK_EXPIRES_IN_SECONDS * 1000,
        resendAvailableAt: now + MOCK_RESEND_AFTER_SECONDS * 1000,
        attempts: 0,
      });

      return {
        challengeId,
        expiresInSeconds: MOCK_EXPIRES_IN_SECONDS,
        resendAfterSeconds: MOCK_RESEND_AFTER_SECONDS,
        maskedDestination: mockMaskedDestination(cnic),
      } satisfies OtpChallenge;
    },

    async resendOtp(challengeId) {
      await wait();
      requireOnline();

      const challenge = challenges.get(challengeId);
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
        challengeId,
        expiresInSeconds: MOCK_EXPIRES_IN_SECONDS,
        resendAfterSeconds: MOCK_RESEND_AFTER_SECONDS,
        maskedDestination: mockMaskedDestination(challenge.cnic),
      } satisfies OtpChallenge;
    },

    async verifyOtp(challengeId, code) {
      await wait();
      requireOnline();

      const challenge = challenges.get(challengeId);
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

      challenges.delete(challengeId);
      return {
        accessToken: `mock_${randomId()}`,
        candidateId: `candidate_${challenge.cnic}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } satisfies AuthSession;
    },
  };
}
