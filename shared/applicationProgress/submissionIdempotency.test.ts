import {
  beginNewSubmissionAttempt,
  clearSubmissionIdempotencyKey,
  EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE,
  retrySubmissionAttempt,
} from './submissionIdempotency';

describe('submission idempotency-key lifecycle', () => {
  it('mints a fresh key when beginning a new attempt', () => {
    const state = beginNewSubmissionAttempt(() => 'key-1');
    expect(state.key).toBe('key-1');
  });

  it('mints a different key each time a new attempt begins', () => {
    let n = 0;
    const generate = () => `key-${++n}`;
    const first = beginNewSubmissionAttempt(generate);
    const second = beginNewSubmissionAttempt(generate);
    expect(first.key).toBe('key-1');
    expect(second.key).toBe('key-2');
  });

  it('reuses the current key when retrying the same failed attempt', () => {
    const started = beginNewSubmissionAttempt(() => 'key-1');
    const retried = retrySubmissionAttempt(started, () => 'key-2');
    expect(retried.key).toBe('key-1');
  });

  it('mints a key on retry only if none exists yet', () => {
    const retried = retrySubmissionAttempt(EMPTY_SUBMISSION_IDEMPOTENCY_KEY_STATE, () => 'key-1');
    expect(retried.key).toBe('key-1');
  });

  it('clears the key after a confirmed success', () => {
    const started = beginNewSubmissionAttempt(() => 'key-1');
    const cleared = clearSubmissionIdempotencyKey();
    expect(cleared.key).toBeNull();
    expect(started.key).toBe('key-1');
  });

  it('mints a new key for a fresh attempt after the key was cleared (e.g. an idempotency conflict)', () => {
    const cleared = clearSubmissionIdempotencyKey();
    const restarted = beginNewSubmissionAttempt(() => 'key-2');
    expect(cleared.key).toBeNull();
    expect(restarted.key).toBe('key-2');
  });
});
