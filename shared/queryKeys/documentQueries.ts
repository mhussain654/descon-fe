// Centralized TanStack Query key factory for every document-review-related
// query (candidate and staff sides), replacing the ad-hoc single-constant-
// per-hook pattern used before this ticket. Every key includes every
// dimension that changes the result:
//
// - `candidateId`/`candidateAssignmentId` (never the access token) so two
//   different authenticated candidates on the same device can never share a
//   cache entry.
// - `locale` so a language switch can never have a stale-locale response
//   overwrite the newly selected locale's data -- it's simply a different
//   cache entry, not something that needs a manual invalidation/guard.
//
// Staff keys deliberately have no staff-session dimension: web shares one
// QueryClient between the candidate and staff experiences and clears it
// entirely on every logout (candidate or staff), so cross-staff-session
// leakage is already structurally prevented at the QueryClient level.
import type { Language } from '../i18n/translations';
import type { DocumentReviewQueueFilters, DocumentReviewQueuePage } from '../adminDocumentReviews/types';

export const documentQueries = {
  candidateChecklist: (candidateId: string, locale: Language) =>
    ['documents', 'candidateChecklist', candidateId, locale] as const,

  applicationProgress: (candidateId: string, locale: Language) =>
    ['documents', 'applicationProgress', candidateId, locale] as const,

  staffQueue: (filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage, locale: Language) =>
    ['documents', 'staffQueue', filters, page, locale] as const,

  /** Matches every `staffQueue(...)` key regardless of filters/page/locale -- for invalidation after a decision, where every open queue view (any filter, any locale tab) needs to refetch, not just the currently-viewed one. */
  staffQueueAll: () => ['documents', 'staffQueue'] as const,

  staffSubmission: (submissionId: string, locale: Language) =>
    ['documents', 'staffSubmission', submissionId, locale] as const,

  /**
   * No dedicated backend endpoint exists for a single candidate's staff-side
   * document summary -- this key is used purely as an invalidation target
   * after an HR decision (ticket: "Invalidate staff candidate/document
   * summaries"), scoped the same way a `staffQueue` call filtered to one
   * candidate would be.
   */
  staffCandidateSummary: (candidateId: string, locale: Language) =>
    ['documents', 'staffCandidateSummary', candidateId, locale] as const,
};
