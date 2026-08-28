// Pure idempotency-key lifecycle for the document-submission flow. Unlike
// document upload (shared/candidateDocuments/idempotency.ts), a submission
// request carries no per-attempt selection (its body is always empty), so
// there is nothing to compare between attempts -- the only question is
// "is this a retry of the current attempt, or a fresh one?", which platform
// hooks answer explicitly by calling `beginNewAttempt` vs `retryAttempt`.

export interface SubmissionIdempotencyKeyState {
  key: string | null;
}

export const EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE: SubmissionIdempotencyKeyState = { key: null };

/**
 * Starts a brand-new submission attempt, always minting a fresh key --
 * used the first time the candidate tries to submit, and again after a
 * terminal outcome that must not replay the previous key (success,
 * idempotency conflict, or a validation/authorization failure such as
 * `documents_incomplete`/`already_submitted` that the candidate can only
 * resolve by changing something before trying again).
 */
export function beginNewSubmissionAttempt(generateKey: () => string): SubmissionIdempotencyKeyState {
  return { key: generateKey() };
}

/**
 * Reuses the current key when retrying the *same* failed submission
 * attempt after an offline, timeout, network, or server failure (ticket:
 * "Reuse the same key when retrying the same failed submission after an
 * offline, timeout, network or server failure."). Falls back to minting a
 * new key only if none exists yet, so this is always safe to call.
 */
export function retrySubmissionAttempt(
  current: SubmissionIdempotencyKeyState,
  generateKey: () => string
): SubmissionIdempotencyKeyState {
  if (current.key) return current;
  return beginNewSubmissionAttempt(generateKey);
}

/** Clears the key after a confirmed successful submission -- a later attempt must mint a fresh key rather than replaying the now-consumed response. */
export function clearSubmissionIdempotencyKey(): SubmissionIdempotencyKeyState {
  return EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE;
}

export function randomSubmissionIdempotencyKey(): string {
  return `candidate-document-submission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
