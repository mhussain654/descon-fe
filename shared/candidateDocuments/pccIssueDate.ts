// Client-side mirror of descon-be's Candidates::Documents::PccIssueDateResolver
// validation (required, valid YYYY-MM-DD, not in the future) -- a UX
// improvement only, the backend remains authoritative and re-validates
// regardless (same rationale as fileValidation.ts).

/** The one requirement code the backend treats specially for issue/expiry-date handling (CandidateDocument::PCC_REQUIREMENT_CODE). */
export const PCC_REQUIREMENT_CODE = 'police_character';

export type PccIssueDateError = 'REQUIRED' | 'INVALID_FORMAT' | 'IN_FUTURE';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Returns the first validation problem with a candidate-entered PCC issue date, or `null` if it passes every client-side check. `today` is injectable for tests. */
export function validatePccIssueDate(value: string, today: Date = new Date()): PccIssueDateError | null {
  const trimmed = value.trim();
  if (!trimmed) return 'REQUIRED';
  if (!ISO_DATE_PATTERN.test(trimmed)) return 'INVALID_FORMAT';

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'INVALID_FORMAT';
  // Date's own normalization silently rolls an invalid calendar date (e.g.
  // 2026-02-30) into a different valid one -- comparing the round-tripped
  // ISO string catches that rather than accepting it.
  if (parsed.toISOString().slice(0, 10) !== trimmed) return 'INVALID_FORMAT';

  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (parsed.getTime() > todayUtc.getTime()) return 'IN_FUTURE';

  return null;
}
