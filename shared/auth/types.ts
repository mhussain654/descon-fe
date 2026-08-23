// Candidate authentication contract (MPS-F201), shared by web and mobile.
//
// The real candidate authentication API (MPS-201) does not exist yet, and
// this ticket explicitly says not to permanently invent endpoint names or
// response shapes. So this file defines only the *behavioral* contract --
// what a candidate auth client can do and what it returns -- not any HTTP
// path or wire format. `candidateAuthClient.ts`'s mock implementation is a
// pure in-memory simulator behind that same contract; a future real
// implementation (calling whatever MPS-201 actually defines, via
// shared/api-client.ts like every other feature) can replace it without any
// screen or hook changing.

/**
 * Stable, non-enumerating failure buckets for the candidate auth flow. UI
 * code localizes copy from `code` alone -- never from a raw server message
 * -- so a real backend's exact wording can never leak an English/Urdu
 * mismatch or (worse) reveal whether a CNIC exists.
 */
export type AuthErrorCode =
  | 'OTP_REQUEST_FAILED' // generic: covers "no such CNIC" and real transient failures identically
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_MAX_ATTEMPTS'
  | 'RESEND_COOLDOWN'
  | 'CHALLENGE_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'UNKNOWN';

export interface AuthError {
  code: AuthErrorCode;
  /** Only set for RESEND_COOLDOWN, so the UI can show an accurate countdown instead of a fixed guess. */
  retryAfterSeconds?: number;
}

/**
 * Returned after requesting (or resending) an OTP. Every timing value here
 * is server-declared -- the UI counts down from these, it never hardcodes
 * its own expiry/cooldown durations (AGENTS.md: "Do not make frontend
 * timing rules the source of truth").
 */
export interface OtpChallenge {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Server-masked destination text (e.g. "•••-•••••••-4"), when the backend chooses to send one. Never computed client-side from a real number. */
  maskedDestination?: string;
}

export interface AuthSession {
  accessToken: string;
  candidateId: string;
  /** ISO 8601 timestamp. */
  expiresAt: string;
}

/**
 * Centralized, typed candidate authentication interface (AGENTS.md /
 * MPS-F201: "Build against a centralized typed authentication interface").
 * Every method rejects with an `AuthError`, mirroring shared/api-client.ts's
 * `ApiError` pattern.
 */
export interface CandidateAuthClient {
  /** Always succeeds with a challenge for any well-formed CNIC -- existence is never disclosed by branching here. */
  requestOtp(cnic: string): Promise<OtpChallenge>;
  resendOtp(challengeId: string): Promise<OtpChallenge>;
  verifyOtp(challengeId: string, code: string): Promise<AuthSession>;
}
