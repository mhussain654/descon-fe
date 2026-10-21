import {
  EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE,
  clearBulkCallIdempotencyKey,
  randomBulkCallIdempotencyKey,
  resolveBulkCallIdempotencyKey,
  type BulkCallSelection,
} from './idempotency';

const selection: BulkCallSelection = { voiceId: 'v1', stageCode: 'verified', limit: 200 };

describe('bulk call idempotency key', () => {
  it('mints a key the first time', () => {
    const state = resolveBulkCallIdempotencyKey(EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE, selection, () => 'key-1');

    expect(state).toEqual({ key: 'key-1', selection });
  });

  it('reuses the key for exactly the same selection, so a retry replays the batch already started', () => {
    const first = resolveBulkCallIdempotencyKey(EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE, selection, () => 'key-1');

    const second = resolveBulkCallIdempotencyKey(first, { ...selection }, () => 'key-2');

    expect(second.key).toBe('key-1');
  });

  it.each([
    ['voice', { voiceId: 'v2' }],
    ['stage', { stageCode: 'fee_paid' }],
    ['limit', { limit: 100 }],
    ['country', { countryCode: 'qatar' }],
    ['project', { projectCode: 'p1' }],
    ['craft', { craftCode: 'welder' }],
    ['search', { search: 'khan' }],
  ])('mints a fresh key when the %s changes', (_name, change) => {
    const first = resolveBulkCallIdempotencyKey(EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE, selection, () => 'key-1');

    const next = resolveBulkCallIdempotencyKey(first, { ...selection, ...change }, () => 'key-2');

    expect(next.key).toBe('key-2');
  });

  it('forgets the key after a success, so the next batch is a new action', () => {
    expect(clearBulkCallIdempotencyKey()).toEqual(EMPTY_BULK_CALL_IDEMPOTENCY_KEY_STATE);
  });

  it('generates distinct readable keys', () => {
    const keys = new Set(Array.from({ length: 20 }, () => randomBulkCallIdempotencyKey()));

    expect(keys.size).toBe(20);
    expect([...keys][0]).toMatch(/^admin-bulk-call-/);
  });
});
