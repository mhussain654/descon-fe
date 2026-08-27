import {
  clearIdempotencyKey,
  EMPTY_IDEMPOTENCY_KEY_STATE,
  resolveIdempotencyKey,
  type IdempotencyKeyState,
} from './idempotency';

describe('resolveIdempotencyKey', () => {
  it('mints a new key for the first selection', () => {
    const next = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-1');
    expect(next).toEqual({ key: 'key-1', selection: { requirementCode: 'passport', fileSignature: 'a' } });
  });

  it('reuses the same key when retrying the same file for the same requirement', () => {
    const first = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-1');
    const retry = resolveIdempotencyKey(first, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-2');
    expect(retry).toBe(first);
    expect(retry.key).toBe('key-1');
  });

  it('mints a new key when a different file is selected for the same requirement', () => {
    const first = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-1');
    const next = resolveIdempotencyKey(first, { requirementCode: 'passport', fileSignature: 'b' }, () => 'key-2');
    expect(next.key).toBe('key-2');
    expect(next.selection).toEqual({ requirementCode: 'passport', fileSignature: 'b' });
  });

  it('mints a new key when the requirement changes, even with the same file signature', () => {
    const first = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-1');
    const next = resolveIdempotencyKey(first, { requirementCode: 'cnic_front', fileSignature: 'a' }, () => 'key-2');
    expect(next.key).toBe('key-2');
    expect(next.selection?.requirementCode).toBe('cnic_front');
  });

  it('never carries one requirement key over into another requirement key', () => {
    const passport = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'passport', fileSignature: 'a' }, () => 'passport-key');
    const cnic = resolveIdempotencyKey(EMPTY_IDEMPOTENCY_KEY_STATE, { requirementCode: 'cnic_front', fileSignature: 'a' }, () => 'cnic-key');
    expect(passport.key).not.toBe(cnic.key);
  });
});

describe('clearIdempotencyKey', () => {
  it('returns the empty state so a later attempt for the same file mints a fresh key', () => {
    const uploaded: IdempotencyKeyState = { key: 'key-1', selection: { requirementCode: 'passport', fileSignature: 'a' } };
    const cleared = clearIdempotencyKey();
    expect(cleared).toEqual(EMPTY_IDEMPOTENCY_KEY_STATE);

    const nextAttempt = resolveIdempotencyKey(cleared, { requirementCode: 'passport', fileSignature: 'a' }, () => 'key-2');
    expect(nextAttempt.key).toBe('key-2');
    expect(nextAttempt.key).not.toBe(uploaded.key);
  });
});
