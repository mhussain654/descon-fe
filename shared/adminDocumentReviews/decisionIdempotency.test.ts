import {
  clearDecisionIdempotencyKey,
  EMPTY_DECISION_IDEMPOTENCY_KEY_STATE,
  resolveDecisionIdempotencyKey,
  type DecisionIdempotencyKeyState,
} from './decisionIdempotency';

function selection(overrides: Partial<{ documentId: string; action: 'verified' | 'rejected'; rejectionReason: string }> = {}) {
  return { documentId: 'doc-1', action: 'verified' as const, rejectionReason: '', ...overrides };
}

describe('resolveDecisionIdempotencyKey', () => {
  it('mints a new key for the first decision attempt', () => {
    const next = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    expect(next).toEqual({ key: 'key-1', selection: selection() });
  });

  it('reuses the same key when retrying the identical decision', () => {
    const first = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const retry = resolveDecisionIdempotencyKey(first, selection(), () => 'key-2');
    expect(retry).toBe(first);
    expect(retry.key).toBe('key-1');
  });

  it('mints a new key when the document changes', () => {
    const first = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveDecisionIdempotencyKey(first, selection({ documentId: 'doc-2' }), () => 'key-2');
    expect(next.key).toBe('key-2');
  });

  it('mints a new key when the action changes from verify to reject', () => {
    const first = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveDecisionIdempotencyKey(
      first,
      selection({ action: 'rejected', rejectionReason: 'Document is unreadable.' }),
      () => 'key-2'
    );
    expect(next.key).toBe('key-2');
  });

  it('mints a new key when the rejection reason changes', () => {
    const first = resolveDecisionIdempotencyKey(
      EMPTY_DECISION_IDEMPOTENCY_KEY_STATE,
      selection({ action: 'rejected', rejectionReason: 'Blurry photo.' }),
      () => 'key-1'
    );
    const next = resolveDecisionIdempotencyKey(
      first,
      selection({ action: 'rejected', rejectionReason: 'Wrong document type.' }),
      () => 'key-2'
    );
    expect(next.key).toBe('key-2');
  });

  it('reuses the key when retrying the same rejection reason verbatim', () => {
    const first = resolveDecisionIdempotencyKey(
      EMPTY_DECISION_IDEMPOTENCY_KEY_STATE,
      selection({ action: 'rejected', rejectionReason: 'Blurry photo.' }),
      () => 'key-1'
    );
    const retry = resolveDecisionIdempotencyKey(
      first,
      selection({ action: 'rejected', rejectionReason: 'Blurry photo.' }),
      () => 'key-2'
    );
    expect(retry).toBe(first);
  });

  it('never carries one document key over into another document key', () => {
    const docA = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection({ documentId: 'a' }), () => 'key-a');
    const docB = resolveDecisionIdempotencyKey(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE, selection({ documentId: 'b' }), () => 'key-b');
    expect(docA.key).not.toBe(docB.key);
  });
});

describe('clearDecisionIdempotencyKey', () => {
  it('returns the empty state so a later attempt, even for the same selection, mints a fresh key', () => {
    const decided: DecisionIdempotencyKeyState = { key: 'key-1', selection: selection() };
    const cleared = clearDecisionIdempotencyKey();
    expect(cleared).toEqual(EMPTY_DECISION_IDEMPOTENCY_KEY_STATE);

    const nextAttempt = resolveDecisionIdempotencyKey(cleared, selection(), () => 'key-2');
    expect(nextAttempt.key).toBe('key-2');
    expect(nextAttempt.key).not.toBe(decided.key);
  });
});
