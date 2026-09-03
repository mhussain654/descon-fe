import { DEFAULT_PAGE_SIZE, readPaymentListStateFromSearchParams, writePaymentListStateToSearchParams } from './paymentListUrlState';

describe('paymentListUrlState', () => {
  it('falls back to no filters/sort and page 1/default size when the URL has no params', () => {
    const state = readPaymentListStateFromSearchParams(new URLSearchParams());
    expect(state.filters).toEqual({
      search: undefined,
      status: undefined,
      providerCode: undefined,
      paymentTypeCode: undefined,
      currencyCode: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      reconciliationState: undefined,
    });
    expect(state.sort).toBeUndefined();
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads search, every filter, sort and page from the URL', () => {
    const params = new URLSearchParams(
      'search=DES-001001&status=paid&provider=kuickpay&type=onboarding_fee&currency=PKR&from=2026-08-01&to=2026-08-31' +
        '&reconciliation=open&sort=-amount&page=3&size=50'
    );
    const state = readPaymentListStateFromSearchParams(params);
    expect(state.filters).toEqual({
      search: 'DES-001001',
      status: 'paid',
      providerCode: 'kuickpay',
      paymentTypeCode: 'onboarding_fee',
      currencyCode: 'PKR',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-31',
      reconciliationState: 'open',
    });
    expect(state.sort).toBe('-amount');
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('drops an unrecognized status code rather than forwarding it to the backend', () => {
    expect(readPaymentListStateFromSearchParams(new URLSearchParams('status=not_a_real_status')).filters.status).toBeUndefined();
  });

  it('drops an unrecognized reconciliation state rather than forwarding it to the backend', () => {
    const state = readPaymentListStateFromSearchParams(new URLSearchParams('reconciliation=bogus'));
    expect(state.filters.reconciliationState).toBeUndefined();
  });

  it('drops a malformed created_from/created_to date rather than forwarding it to the backend', () => {
    const state = readPaymentListStateFromSearchParams(new URLSearchParams('from=not-a-date&to=08/31/2026'));
    expect(state.filters.createdFrom).toBeUndefined();
    expect(state.filters.createdTo).toBeUndefined();
  });

  it('drops an unrecognized sort value rather than forwarding it to the backend', () => {
    expect(readPaymentListStateFromSearchParams(new URLSearchParams('sort=not_a_real_sort')).sort).toBeUndefined();
  });

  it('falls back to page 1 for an invalid or negative page number', () => {
    expect(readPaymentListStateFromSearchParams(new URLSearchParams('page=-5')).page.number).toBe(1);
    expect(readPaymentListStateFromSearchParams(new URLSearchParams('page=abc')).page.number).toBe(1);
  });

  it('omits search/filters/sort from the URL when unset', () => {
    const params = writePaymentListStateToSearchParams({}, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(Array.from(params.keys())).toEqual([]);
  });

  it('omits page/size from the URL when they are page 1 / the default size', () => {
    const params = writePaymentListStateToSearchParams({ search: 'Ahmed' }, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(params.has('page')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('writes every set filter, sort and non-default page/size explicitly', () => {
    const params = writePaymentListStateToSearchParams(
      {
        search: 'Ahmed',
        status: 'paid',
        providerCode: 'kuickpay',
        paymentTypeCode: 'onboarding_fee',
        currencyCode: 'PKR',
        createdFrom: '2026-08-01',
        createdTo: '2026-08-31',
        reconciliationState: 'open',
      },
      '-amount',
      { number: 2, size: 50 }
    );
    expect(params.get('search')).toBe('Ahmed');
    expect(params.get('status')).toBe('paid');
    expect(params.get('provider')).toBe('kuickpay');
    expect(params.get('type')).toBe('onboarding_fee');
    expect(params.get('currency')).toBe('PKR');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBe('2026-08-31');
    expect(params.get('reconciliation')).toBe('open');
    expect(params.get('sort')).toBe('-amount');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read/write without losing state', () => {
    const original = new URLSearchParams('search=Ahmed&status=failed&sort=paid_at&page=2&size=10');
    const state = readPaymentListStateFromSearchParams(original);
    const rebuilt = writePaymentListStateToSearchParams(state.filters, state.sort, state.page);

    expect(readPaymentListStateFromSearchParams(rebuilt)).toEqual(state);
  });
});
