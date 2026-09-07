// Candidate consent acknowledgment types (MPS-204), shared by web and
// mobile, wired to the real backend documented in descon-be's
// openapi.yaml:
//   GET  /api/v1/candidate/consent
//   POST /api/v1/candidate/consent
import type { ConsentStatus } from '../auth/types';

export type CandidateConsentErrorCode =
  | 'SESSION_EXPIRED'
  /** 403 `inactive_account` -- the candidate's own account was deactivated after the session was issued. */
  | 'INACTIVE_ACCOUNT'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface CandidateConsentError {
  code: CandidateConsentErrorCode;
}

export interface CandidateConsentClient {
  /** Fetches the candidate's current consent status. Reachable even before the candidate has accepted -- the backend exempts this endpoint from its own consent gate. */
  fetchStatus(accessToken: string): Promise<ConsentStatus>;
  /** Records acceptance of the current policy version. Idempotent -- safe to call again for a candidate who already accepted. */
  accept(accessToken: string): Promise<ConsentStatus>;
}
