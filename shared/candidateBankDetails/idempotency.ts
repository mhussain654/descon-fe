// Pure idempotency-key lifecycle for the bank-details submit flow, mirroring
// shared/candidateDocuments/idempotency.ts's identical shape -- platform
// hooks own the actual form state and call `resolveIdempotencyKey`
// whenever it changes; this module only decides reuse-vs-mint.

export interface BankDetailIdempotencySelection {
  /** A signature of the submitted content -- account title/number/bank name plus the file's own signature -- so editing any field between attempts is treated as a fresh submission, not a retry. */
  contentSignature: string;
}

export interface BankDetailIdempotencyKeyState {
  key: string | null;
  selection: BankDetailIdempotencySelection | null;
}

export const EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE: BankDetailIdempotencyKeyState = { key: null, selection: null };

/**
 * Decides whether the current submission should reuse the active
 * idempotency key or mint a fresh one -- reuses only when the content
 * signature exactly matches the current selection (a genuine retry of the
 * same submission), mirroring resolveIdempotencyKey's identical rationale.
 */
export function resolveBankDetailIdempotencyKey(
  current: BankDetailIdempotencyKeyState,
  next: BankDetailIdempotencySelection,
  generateKey: () => string
): BankDetailIdempotencyKeyState {
  if (current.key && current.selection && current.selection.contentSignature === next.contentSignature) {
    return current;
  }
  return { key: generateKey(), selection: next };
}

/** Clears the key after a confirmed successful submission -- a later submission (even with identical content) must mint a fresh key rather than replaying the now-consumed response. */
export function clearBankDetailIdempotencyKey(): BankDetailIdempotencyKeyState {
  return EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE;
}

export function randomBankDetailIdempotencyKey(): string {
  return `candidate-bank-detail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
