// Pure idempotency-key lifecycle for triggering an admin AI call. Mirrors
// shared/adminDocumentReviews/decisionIdempotency.ts's reuse-vs-mint
// design: the backend's default request fingerprint
// (Idempotency::RequestFingerprint, since TriggerOutboundCallService's
// controller action passes no explicit `fingerprint:` override) hashes the
// request body -- so reusing a key across a changed call_reason would
// otherwise surface as a confusing idempotency_conflict instead of just
// starting a fresh attempt.

import type { AdminAiCallReason } from './types';

export interface CallSelection {
  candidateId: string;
  callReason: AdminAiCallReason;
}

export interface CallIdempotencyKeyState {
  key: string | null;
  selection: CallSelection | null;
}

export const EMPTY_CALL_IDEMPOTENCY_KEY_STATE: CallIdempotencyKeyState = { key: null, selection: null };

function sameSelection(a: CallSelection, b: CallSelection): boolean {
  return a.candidateId === b.candidateId && a.callReason === b.callReason;
}

/** Reuses the current key only when candidate and call_reason both exactly match -- otherwise mints a fresh one, for either a genuinely new intended call or a manual retry of the same one. */
export function resolveCallIdempotencyKey(
  current: CallIdempotencyKeyState,
  next: CallSelection,
  generateKey: () => string
): CallIdempotencyKeyState {
  if (current.key && current.selection && sameSelection(current.selection, next)) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** Clears the key after a confirmed successful trigger, or a deliberate cancellation -- a later attempt (even for the same candidate/reason) must mint a fresh key rather than replaying a consumed response. */
export function clearCallIdempotencyKey(): CallIdempotencyKeyState {
  return EMPTY_CALL_IDEMPOTENCY_KEY_STATE;
}

export function randomCallIdempotencyKey(): string {
  return `admin-ai-call-trigger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
