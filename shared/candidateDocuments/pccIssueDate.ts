// Client-side mirror of descon-be's Candidates::Documents::PccIssueDateResolver
// validation (required, valid YYYY-MM-DD, not in the future, issued no more
// than 5 months ago) -- a UX
// improvement only, the backend remains authoritative and re-validates
// regardless (same rationale as fileValidation.ts).

/** The one requirement code the backend treats specially for issue/expiry-date handling (CandidateDocument::PCC_REQUIREMENT_CODE). */
export const PCC_REQUIREMENT_CODE = 'police_character';

export type PccIssueDateError = 'REQUIRED' | 'INVALID_FORMAT' | 'IN_FUTURE' | 'TOO_OLD';

/** A PCC is valid for 6 months; one issued more than 5 months ago cannot be uploaded (client rule). */
export const PCC_MAXIMUM_AGE_MONTHS = 5;

/** `date` moved back by whole months, clamped to the last day of a shorter month (as Rails' `months.ago` does). */
function monthsBefore(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)));
}

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
  if (parsed.getTime() < monthsBefore(todayUtc, PCC_MAXIMUM_AGE_MONTHS).getTime()) return 'TOO_OLD';

  return null;
}
