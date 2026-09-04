// Query key factory for the candidate workflow history, plus the staff/
// admin equivalents (MPS-F501 Phase A) -- see documentQueries.ts for why
// `candidateId` and `locale` are both part of every key. `candidateId` here
// is always the backend's candidate public_id, never a staff session
// dimension -- see documentQueries.ts's own comment for why staff keys
// don't need one (one shared QueryClient, cleared entirely on any logout).
import type { Language } from '../i18n/translations';

export const workflowQueries = {
  history: (candidateId: string, locale: Language) => ['workflow', 'history', candidateId, locale] as const,
  flightDetail: (candidateId: string, locale: Language) => ['workflow', 'flightDetail', candidateId, locale] as const,

  adminState: (candidateId: string, locale: Language) => ['workflow', 'adminState', candidateId, locale] as const,
  adminTransitions: (candidateId: string, locale: Language) => ['workflow', 'adminTransitions', candidateId, locale] as const,
  adminHistory: (candidateId: string, locale: Language) => ['workflow', 'adminHistory', candidateId, locale] as const,
  /** QVC attempts have their own dedicated backend resource (unlike protection, read from adminState's `protection` field) -- MPS-F501 Phase B. */
  adminQvcAttempts: (candidateId: string, locale: Language) => ['workflow', 'adminQvcAttempts', candidateId, locale] as const,
  /** Visa decisions and flight/mobilization details are also dedicated backend resources -- MPS-F501 Phase C. */
  adminVisaDecisions: (candidateId: string, locale: Language) => ['workflow', 'adminVisaDecisions', candidateId, locale] as const,
  adminFlightDetail: (candidateId: string, locale: Language) => ['workflow', 'adminFlightDetail', candidateId, locale] as const,
};
