// Candidate authentication contract (MPS-F201, wired to the real MPS-201/
// MPS-206 backend), shared by web and mobile.
//
// The real API (see descon-be openapi.yaml's /api/v1/candidate/auth/otp/*)
// has no separate "resend" endpoint and no server-issued challenge id --
// request and verify both re-key off the CNIC itself, with the OTP challenge
// state tracked entirely server-side. `resendOtp`/`verifyOtp` therefore take
// `cnic`, not an opaque challenge handle. This file defines the *behavioral*
// contract a candidate auth client implements; `candidateAuthClient.ts` is
// the in-memory mock (dev/test only) and `realCandidateAuthClient.ts` is the
// real implementation calling shared/api-client.ts.

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
  | 'CHALLENGE_NOT_FOUND' // mock-only: verify/resend called for a CNIC that never requested a challenge -- the real backend folds this into OTP_INVALID (see VerifyService's missing_challenge? path), so this code is unreachable through the real client
  | 'RATE_LIMITED' // server-enforced 429 (per-IP or per-CNIC throttle), distinct from the client-computed RESEND_COOLDOWN
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVICE_UNAVAILABLE' // no real backend configured for this build (see candidateAuthClient.ts's production guard)
  | 'UNKNOWN';

/** The OTP is always this many digits. Shared so the "is this code complete?" check (screens, the flow hook) can't drift from what the fields themselves render. */
export const OTP_LENGTH = 6;

export interface AuthError {
  code: AuthErrorCode;
  /** Set for RESEND_COOLDOWN and RATE_LIMITED, so the UI can show an accurate countdown instead of a fixed guess. */
  retryAfterSeconds?: number;
}

/**
 * Returned after requesting (or resending) an OTP. Every timing value here
 * is server-declared -- the UI counts down from these, it never hardcodes
 * its own expiry/cooldown durations (AGENTS.md: "Do not make frontend
 * timing rules the source of truth").
 */
export interface OtpChallenge {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Server-masked destination text (e.g. "•••-•••••••-4"), when the backend chooses to send one. Never computed client-side from a real number. The real backend does not currently send one -- this stays optional so the UI's existing rendering (already `challenge?.maskedDestination`-guarded) needs no change if that's added later. */
  maskedDestination?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  candidateId: string;
  candidateName: string;
  preferredLocale: 'en' | 'ur';
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
  /** Identical to requestOtp on the real backend -- there is no separate resend endpoint, a repeat request just re-delivers within the same cooldown window. Kept as a distinct method so the UI's intent ("the candidate asked to resend") stays explicit and independently testable. */
  resendOtp(cnic: string): Promise<OtpChallenge>;
  verifyOtp(cnic: string, code: string): Promise<AuthSession>;
}
