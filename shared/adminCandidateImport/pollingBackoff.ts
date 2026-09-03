// Controlled backoff for polling GET /admin/candidate_imports/{id} while a
// batch is `queued`/`processing` (ticket: "Poll the import-detail API with
// controlled backoff. Stop polling on completed, partial, failed, or
// invalidated."). No polling precedent in this repo uses actual backoff --
// both existing pollers (shared/candidateDocuments/pendingReviewPolling.ts,
// shared/payments/checkoutPolling.ts) use a single fixed interval -- so this
// is a deliberate, documented choice: short intervals early (most imports
// finish in seconds) widening to a steady cadence, so a slow batch doesn't
// get hammered with requests for however long it takes to finish.
import type { CandidateImportStatus } from './types';

/** Fibonacci-ish schedule in ms, then holds at the last value. */
const POLL_INTERVALS_MS = [2_000, 3_000, 5_000, 8_000, 13_000, 20_000] as const;

export function isTerminalImportStatus(status: CandidateImportStatus): boolean {
  return status !== 'queued' && status !== 'processing';
}

/** `pollCount` is how many polls have already happened for this batch (0 for the very first one). Returns the delay before the *next* poll. */
export function nextImportPollDelayMs(pollCount: number): number {
  const index = Math.min(Math.max(pollCount, 0), POLL_INTERVALS_MS.length - 1);
  return POLL_INTERVALS_MS[index];
}
