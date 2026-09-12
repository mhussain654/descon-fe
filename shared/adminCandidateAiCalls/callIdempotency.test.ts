import {
  clearCallIdempotencyKey,
  EMPTY_CALL_IDEMPOTENCY_KEY_STATE,
  resolveCallIdempotencyKey,
  type CallIdempotencyKeyState,
} from './callIdempotency';

function selection(overrides: Partial<{ candidateId: string; callReason: 'missing_documents' | 'flight_information' }> = {}) {
  return { candidateId: 'candidate-1', callReason: 'missing_documents' as const, ...overrides };
}

describe('resolveCallIdempotencyKey', () => {
  it('mints a new key for the first trigger attempt', () => {
    const next = resolveCallIdempotencyKey(EMPTY_CALL_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    expect(next).toEqual({ key: 'key-1', selection: selection() });
  });

  it('reuses the same key when retrying the identical trigger', () => {
    const first = resolveCallIdempotencyKey(EMPTY_CALL_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const retry = resolveCallIdempotencyKey(first, selection(), () => 'key-2');
    expect(retry).toBe(first);
    expect(retry.key).toBe('key-1');
  });

  it('mints a new key when the call_reason changes', () => {
    const first = resolveCallIdempotencyKey(EMPTY_CALL_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveCallIdempotencyKey(first, selection({ callReason: 'flight_information' }), () => 'key-2');
    expect(next.key).toBe('key-2');
  });

  it('never carries one candidate key over into another candidate key', () => {
    const a = resolveCallIdempotencyKey(EMPTY_CALL_IDEMPOTENCY_KEY_STATE, selection({ candidateId: 'a' }), () => 'key-a');
    const b = resolveCallIdempotencyKey(EMPTY_CALL_IDEMPOTENCY_KEY_STATE, selection({ candidateId: 'b' }), () => 'key-b');
    expect(a.key).not.toBe(b.key);
  });
});

describe('clearCallIdempotencyKey', () => {
  it('returns the empty state so a later attempt, even for the same selection, mints a fresh key', () => {
    const triggered: CallIdempotencyKeyState = { key: 'key-1', selection: selection() };
    const cleared = clearCallIdempotencyKey();
    expect(cleared).toEqual(EMPTY_CALL_IDEMPOTENCY_KEY_STATE);

    const nextAttempt = resolveCallIdempotencyKey(cleared, selection(), () => 'key-2');
    expect(nextAttempt.key).toBe('key-2');
    expect(nextAttempt.key).not.toBe(triggered.key);
  });
});
