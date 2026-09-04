import {
  clearBankDetailIdempotencyKey,
  EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE,
  randomBankDetailIdempotencyKey,
  resolveBankDetailIdempotencyKey,
} from './idempotency';

describe('resolveBankDetailIdempotencyKey', () => {
  it('mints a fresh key from the empty state', () => {
    const resolved = resolveBankDetailIdempotencyKey(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE, { contentSignature: 'a' }, () => 'key-1');
    expect(resolved).toEqual({ key: 'key-1', selection: { contentSignature: 'a' } });
  });

  it('reuses the current key when the content signature is unchanged (a retry)', () => {
    const current = { key: 'key-1', selection: { contentSignature: 'a' } };
    const resolved = resolveBankDetailIdempotencyKey(current, { contentSignature: 'a' }, () => 'key-2');
    expect(resolved).toBe(current);
  });

  it('mints a fresh key when the content signature changed (a genuinely new submission)', () => {
    const current = { key: 'key-1', selection: { contentSignature: 'a' } };
    const resolved = resolveBankDetailIdempotencyKey(current, { contentSignature: 'b' }, () => 'key-2');
    expect(resolved).toEqual({ key: 'key-2', selection: { contentSignature: 'b' } });
  });
});

describe('clearBankDetailIdempotencyKey', () => {
  it('returns the empty state', () => {
    expect(clearBankDetailIdempotencyKey()).toEqual(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE);
  });
});

describe('randomBankDetailIdempotencyKey', () => {
  it('generates a unique, prefixed key on every call', () => {
    const a = randomBankDetailIdempotencyKey();
    const b = randomBankDetailIdempotencyKey();
    expect(a).toMatch(/^candidate-bank-detail-/);
    expect(a).not.toBe(b);
  });
});
