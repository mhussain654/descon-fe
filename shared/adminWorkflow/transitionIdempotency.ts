// Pure idempotency-key lifecycle for a staff workflow-transition submission.
// Mirrors shared/adminDocumentReviews/decisionIdempotency.ts's reuse-vs-mint
// design: the backend's own transition fingerprint
// (CandidateWorkflows::TransitionFingerprint) hashes the candidate, the
// destination stage, the expected-current-stage guard and the evidence
// together, so reusing a key across a changed selection would otherwise
// surface as a confusing idempotency_conflict instead of just starting a
// fresh attempt -- and the ticket explicitly requires "one stable
// idempotency key for retries of the same intended action."

export interface TransitionSelection {
  candidateId: string;
  toStageCode: string;
  /** Undefined counts as its own distinct value from any string -- a stale-state refresh that newly discovers/changes the expected stage must mint a fresh key, never reuse one resolved before the refresh. */
  expectedCurrentStageCode: string | undefined;
}

export interface TransitionIdempotencyKeyState {
  key: string | null;
  selection: TransitionSelection | null;
}

export const EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE: TransitionIdempotencyKeyState = { key: null, selection: null };

function sameSelection(a: TransitionSelection, b: TransitionSelection): boolean {
  return (
    a.candidateId === b.candidateId &&
    a.toStageCode === b.toStageCode &&
    a.expectedCurrentStageCode === b.expectedCurrentStageCode
  );
}

/** Reuses the current key only when candidate, destination stage and expected-current-stage all exactly match -- otherwise mints a fresh one, for either a genuinely new intended transition or a manual retry after refreshing a stale state. */
export function resolveTransitionIdempotencyKey(
  current: TransitionIdempotencyKeyState,
  next: TransitionSelection,
  generateKey: () => string
): TransitionIdempotencyKeyState {
  if (current.key && current.selection && sameSelection(current.selection, next)) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** Clears the key after a confirmed successful transition, or a deliberate cancellation -- a later attempt (even for the same candidate/destination) must mint a fresh key rather than replaying a consumed response. */
export function clearTransitionIdempotencyKey(): TransitionIdempotencyKeyState {
  return EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE;
}

export function randomTransitionIdempotencyKey(): string {
  return `admin-workflow-transition-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
