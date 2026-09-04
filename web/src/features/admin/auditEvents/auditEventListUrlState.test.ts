import { DEFAULT_PAGE_SIZE, readAuditEventListStateFromSearchParams, writeAuditEventListStateToSearchParams } from './auditEventListUrlState';

describe('auditEventListUrlState', () => {
  it('falls back to no filters/sort and page 1/default size when the URL has no params', () => {
    const state = readAuditEventListStateFromSearchParams(new URLSearchParams());
    expect(state.filters).toEqual({
      actor: undefined,
      action: undefined,
      entityType: undefined,
      candidate: undefined,
      occurredFrom: undefined,
      occurredTo: undefined,
    });
    expect(state.sort).toBeUndefined();
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads every filter, sort and page from the URL', () => {
    const params = new URLSearchParams(
      'actor=bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd&action=candidate_document_verified&entity_type=CandidateDocument' +
        '&candidate=d8805480-7d1b-4ef4-aee6-c76dd026e3e4&from=2026-08-01&to=2026-08-31&sort=occurred_at&page=3&size=50'
    );
    const state = readAuditEventListStateFromSearchParams(params);
    expect(state.filters).toEqual({
      actor: 'bbe3e0b4-9237-4e8d-9bd7-04fe0e9ce8dd',
      action: 'candidate_document_verified',
      entityType: 'CandidateDocument',
      candidate: 'd8805480-7d1b-4ef4-aee6-c76dd026e3e4',
      occurredFrom: '2026-08-01',
      occurredTo: '2026-08-31',
    });
    expect(state.sort).toBe('occurred_at');
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('drops an unrecognized sort value rather than forwarding it to the backend', () => {
    expect(readAuditEventListStateFromSearchParams(new URLSearchParams('sort=not_a_real_sort')).sort).toBeUndefined();
  });

  it('drops a malformed occurred_from/occurred_to date rather than forwarding it to the backend', () => {
    const state = readAuditEventListStateFromSearchParams(new URLSearchParams('from=not-a-date&to=08/31/2026'));
    expect(state.filters.occurredFrom).toBeUndefined();
    expect(state.filters.occurredTo).toBeUndefined();
  });

  it('falls back to page 1 for an invalid or negative page number', () => {
    expect(readAuditEventListStateFromSearchParams(new URLSearchParams('page=-5')).page.number).toBe(1);
    expect(readAuditEventListStateFromSearchParams(new URLSearchParams('page=abc')).page.number).toBe(1);
  });

  it('omits filters/sort from the URL when unset', () => {
    const params = writeAuditEventListStateToSearchParams({}, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(Array.from(params.keys())).toEqual([]);
  });

  it('omits page/size from the URL when they are page 1 / the default size', () => {
    const params = writeAuditEventListStateToSearchParams({ actor: 'x' }, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(params.has('page')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('writes every set filter, sort and non-default page/size explicitly', () => {
    const params = writeAuditEventListStateToSearchParams(
      {
        actor: 'actor-id',
        action: 'payment_corrected',
        entityType: 'Payment',
        candidate: 'candidate-id',
        occurredFrom: '2026-08-01',
        occurredTo: '2026-08-31',
      },
      'occurred_at',
      { number: 2, size: 50 }
    );
    expect(params.get('actor')).toBe('actor-id');
    expect(params.get('action')).toBe('payment_corrected');
    expect(params.get('entity_type')).toBe('Payment');
    expect(params.get('candidate')).toBe('candidate-id');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('sort')).toBe('occurred_at');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read/write without losing state', () => {
    const original = new URLSearchParams('actor=a1&action=candidate_document_rejected&sort=occurred_at&page=2&size=10');
    const state = readAuditEventListStateFromSearchParams(original);
    const rebuilt = writeAuditEventListStateToSearchParams(state.filters, state.sort, state.page);

    expect(readAuditEventListStateFromSearchParams(rebuilt)).toEqual(state);
  });
});
