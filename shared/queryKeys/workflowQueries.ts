// Query key factory for the candidate workflow history, plus the staff/
// admin equivalents (MPS-F501 Phase A) -- see documentQueries.ts for why
// `candidateId` and `locale` are both part of every key. `candidateId` here
// is always the backend's candidate public_id, never a staff session
// dimension -- see documentQueries.ts's own comment for why staff keys
// don't need one (one shared QueryClient, cleared entirely on any logout).
import type { Language } from '../i18n/translations';

export const workflowQueries = {
  history: (candidateId: string, locale: Language) => ['workflow', 'history', candidateId, locale] as const,

  adminState: (candidateId: string, locale: Language) => ['workflow', 'adminState', candidateId, locale] as const,
  adminTransitions: (candidateId: string, locale: Language) => ['workflow', 'adminTransitions', candidateId, locale] as const,
  adminHistory: (candidateId: string, locale: Language) => ['workflow', 'adminHistory', candidateId, locale] as const,
};
