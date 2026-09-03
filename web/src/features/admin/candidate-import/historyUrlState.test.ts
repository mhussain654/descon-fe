import { DEFAULT_PAGE_SIZE, readHistoryStateFromSearchParams, writeHistoryStateToSearchParams } from './historyUrlState';

describe('historyUrlState', () => {
  it('falls back to no filters and page 1/default size when the URL has no params', () => {
    const state = readHistoryStateFromSearchParams(new URLSearchParams());
    expect(state.filters).toEqual({ status: undefined, createdFrom: undefined, createdTo: undefined, templateVersion: undefined });
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads status, date range, template version and page from the URL', () => {
    const params = new URLSearchParams('status=failed&from=2026-08-01&to=2026-08-31&templateVersion=v1&page=3&size=50');
    const state = readHistoryStateFromSearchParams(params);
    expect(state.filters).toEqual({ status: 'failed', createdFrom: '2026-08-01', createdTo: '2026-08-31', templateVersion: 'v1' });
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('drops an unrecognized status rather than forwarding it to the backend', () => {
    const state = readHistoryStateFromSearchParams(new URLSearchParams('status=not_a_real_status'));
    expect(state.filters.status).toBeUndefined();
  });

  it('drops a malformed date rather than forwarding it to the backend', () => {
    const state = readHistoryStateFromSearchParams(new URLSearchParams('from=not-a-date'));
    expect(state.filters.createdFrom).toBeUndefined();
  });

  it('falls back to page 1 for an invalid or negative page number', () => {
    expect(readHistoryStateFromSearchParams(new URLSearchParams('page=-5')).page.number).toBe(1);
    expect(readHistoryStateFromSearchParams(new URLSearchParams('page=abc')).page.number).toBe(1);
  });

  it('omits filters/page from the URL when unset or at the default', () => {
    const params = writeHistoryStateToSearchParams({}, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(Array.from(params.keys())).toEqual([]);
  });

  it('writes every set filter and non-default page/size explicitly', () => {
    const params = writeHistoryStateToSearchParams(
      { status: 'partial', createdFrom: '2026-08-01', createdTo: '2026-08-31', templateVersion: 'v1' },
      { number: 2, size: 50 }
    );
    expect(params.get('status')).toBe('partial');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('templateVersion')).toBe('v1');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read -> write -> read unchanged', () => {
    const original = readHistoryStateFromSearchParams(new URLSearchParams('status=completed&from=2026-08-01&page=2&size=50'));
    const written = writeHistoryStateToSearchParams(original.filters, original.page);
    const roundTripped = readHistoryStateFromSearchParams(written);
    expect(roundTripped).toEqual(original);
  });
});
