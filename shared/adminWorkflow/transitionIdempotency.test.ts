import {
  clearTransitionIdempotencyKey,
  EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE,
  resolveTransitionIdempotencyKey,
  type TransitionIdempotencyKeyState,
} from './transitionIdempotency';

function selection(overrides: Partial<{ candidateId: string; toStageCode: string; expectedCurrentStageCode: string | undefined }> = {}) {
  return {
    candidateId: 'candidate-1',
    toStageCode: 'documents_shared_with_qatar_bu',
    expectedCurrentStageCode: 'fee_paid' as string | undefined,
    ...overrides,
  };
}

describe('resolveTransitionIdempotencyKey', () => {
  it('mints a new key for the first transition attempt', () => {
    const next = resolveTransitionIdempotencyKey(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    expect(next).toEqual({ key: 'key-1', selection: selection() });
  });

  it('reuses the same key when retrying the identical intended transition', () => {
    const first = resolveTransitionIdempotencyKey(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const retry = resolveTransitionIdempotencyKey(first, selection(), () => 'key-2');
    expect(retry).toBe(first);
    expect(retry.key).toBe('key-1');
  });

  it('mints a new key when the candidate changes', () => {
    const first = resolveTransitionIdempotencyKey(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveTransitionIdempotencyKey(first, selection({ candidateId: 'candidate-2' }), () => 'key-2');
    expect(next.key).toBe('key-2');
  });

  it('mints a new key when the destination stage changes', () => {
    const first = resolveTransitionIdempotencyKey(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveTransitionIdempotencyKey(first, selection({ toStageCode: 'fee_paid' }), () => 'key-2');
    expect(next.key).toBe('key-2');
  });

  it('mints a new key when the expected-current-stage guard changes (e.g. after refreshing a stale state)', () => {
    const first = resolveTransitionIdempotencyKey(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE, selection(), () => 'key-1');
    const next = resolveTransitionIdempotencyKey(first, selection({ expectedCurrentStageCode: 'verified' }), () => 'key-2');
    expect(next.key).toBe('key-2');
  });

  it('never carries one candidate key over into another candidate key', () => {
    const candidateA = resolveTransitionIdempotencyKey(
      EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE,
      selection({ candidateId: 'a' }),
      () => 'key-a'
    );
    const candidateB = resolveTransitionIdempotencyKey(
      EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE,
      selection({ candidateId: 'b' }),
      () => 'key-b'
    );
    expect(candidateA.key).not.toBe(candidateB.key);
  });
});

describe('clearTransitionIdempotencyKey', () => {
  it('returns the empty state so a later attempt, even for the same selection, mints a fresh key', () => {
    const decided: TransitionIdempotencyKeyState = { key: 'key-1', selection: selection() };
    const cleared = clearTransitionIdempotencyKey();
    expect(cleared).toEqual(EMPTY_TRANSITION_IDEMPOTENCY_KEY_STATE);

    const nextAttempt = resolveTransitionIdempotencyKey(cleared, selection(), () => 'key-2');
    expect(nextAttempt.key).toBe('key-2');
    expect(nextAttempt.key).not.toBe(decided.key);
  });
});
