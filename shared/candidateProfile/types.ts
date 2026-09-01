// Candidate self-profile types (frontend ticket: "Admin Candidate Import UI
// and Candidate Profile Integration"), shared by web and mobile, wired to
// the real backend documented in descon-be's openapi.yaml:
//   GET /api/v1/candidate/profile
//
// Only the approved fields from that contract are represented here -- see
// CandidateProfile's doc comments for why each is safe to render.
import type { PaymentEligibility } from '../payments/types';

export interface CandidateWorkflowStage {
  code: string;
  name: string;
}

export interface CandidateProfile {
  /** The candidate's own public id, from the authenticated session -- never a value the UI can be made to substitute (AGENTS.md/ticket: "Candidate identity comes from authentication, not a frontend-provided ID"). */
  id: string;
  fullName: string;
  /** Already masked server-side (e.g. "42101-*******-1") -- never the full CNIC. */
  maskedCnic: string;
  /** Null when the candidate has no assignment yet (same condition as `currentWorkflowStage` being null -- both come from the same, not-yet-created CandidateAssignment). */
  referenceNumber: string | null;
  preferredLocale: 'en' | 'ur';
  /** A backend status code (e.g. "registered") -- map to a localized label at render time, never render the raw code (AGENTS.md: "Do not translate identifiers ... directly"). */
  candidateStatus: string;
  /** Null when the candidate has no assignment yet. */
  currentWorkflowStage: CandidateWorkflowStage | null;
  active: boolean;
  /** Same eligibility/latest-payment shape as GET /candidate/payment (MPS-F601) -- kept in sync here purely so other screens can read it without a second fetch; the dedicated payment page/journey is still the source of truth for acting on it. */
  payment: PaymentEligibility;
}

export type CandidateProfileErrorCode =
  | 'SESSION_EXPIRED'
  /** 403 `inactive_account` -- the candidate's own account was deactivated after the session was issued. */
  | 'INACTIVE_ACCOUNT'
  /** A 403 for any other/unrecognized reason (forward-compatible; nothing in the app triggers this today). */
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateProfileError {
  code: CandidateProfileErrorCode;
  retryAfterSeconds?: number;
}

export interface CandidateProfileClient {
  /** The candidate's own session access token -- the only thing that determines whose profile comes back; there is no id parameter to tamper with. */
  getProfile(accessToken: string): Promise<CandidateProfile>;
}
