// Pure idempotency-key lifecycle for a verify/reject decision. Mirrors
// shared/candidateDocuments/idempotency.ts's reuse-vs-mint design, extended
// to the inputs that must each independently force a fresh key (ticket:
// "Changing document requires a new key. Changing action requires a new
// key. Changing rejection reason requires a new key.") -- the backend's own
// DecisionFingerprint hashes exactly these (document public_id, action,
// rejection_reason, and -- MPS-404 -- issued_on/expires_on) plus the
// method/path, so reusing a key across a changed selection would otherwise
// surface as a confusing idempotency_conflict instead of just starting a
// new attempt.

export type ReviewDecisionAction = 'verified' | 'rejected';

export interface DecisionSelection {
  documentId: string;
  action: ReviewDecisionAction;
  /** Empty string for a 'verified' decision -- only meaningful for 'rejected'. */
  rejectionReason: string;
  /** Only meaningful for a 'verified' decision on an OCR-supported document type (MPS-404). Empty string when not applicable. */
  issuedOn: string;
  expiresOn: string;
}

export interface DecisionIdempotencyKeyState {
  key: string | null;
  selection: DecisionSelection | null;
}

export const EMPTY_DECISION_IDEMPOTENCY_KEY_STATE: DecisionIdempotencyKeyState = { key: null, selection: null };

function sameSelection(a: DecisionSelection, b: DecisionSelection): boolean {
  return (
    a.documentId === b.documentId &&
    a.action === b.action &&
    a.rejectionReason === b.rejectionReason &&
    a.issuedOn === b.issuedOn &&
    a.expiresOn === b.expiresOn
  );
}

/** Reuses the current key only when document, action and rejection reason all exactly match -- otherwise mints a fresh one, for either a genuinely new decision or a manual retry of the same one. */
export function resolveDecisionIdempotencyKey(
  current: DecisionIdempotencyKeyState,
  next: DecisionSelection,
  generateKey: () => string
): DecisionIdempotencyKeyState {
  if (current.key && current.selection && sameSelection(current.selection, next)) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** Clears the key after a confirmed successful decision, or a deliberate cancellation -- a later attempt (even for the same document/action/reason) must mint a fresh key rather than replaying a consumed response. */
export function clearDecisionIdempotencyKey(): DecisionIdempotencyKeyState {
  return EMPTY_DECISION_IDEMPOTENCY_KEY_STATE;
}

export function randomDecisionIdempotencyKey(): string {
  return `admin-document-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
