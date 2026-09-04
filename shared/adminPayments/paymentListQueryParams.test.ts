import { buildPaymentListQuery } from './paymentListQueryParams';

describe('buildPaymentListQuery', () => {
  it('returns an empty string when nothing is set', () => {
    expect(buildPaymentListQuery({}, undefined, {})).toBe('');
  });

  it('serializes search', () => {
    expect(buildPaymentListQuery({ search: 'Ahmed Ali' }, undefined, {})).toBe('?search=Ahmed%20Ali');
  });

  it('trims whitespace-only search to nothing', () => {
    expect(buildPaymentListQuery({ search: '   ' }, undefined, {})).toBe('');
  });

  it('serializes filter[status], filter[provider_code], filter[payment_type_code] and filter[currency_code]', () => {
    const query = buildPaymentListQuery(
      { status: 'paid', providerCode: 'kuickpay', paymentTypeCode: 'onboarding_fee', currencyCode: 'PKR' },
      undefined,
      {}
    );
    expect(query).toContain('filter%5Bstatus%5D=paid');
    expect(query).toContain('filter%5Bprovider_code%5D=kuickpay');
    expect(query).toContain('filter%5Bpayment_type_code%5D=onboarding_fee');
    expect(query).toContain('filter%5Bcurrency_code%5D=PKR');
  });

  it('serializes filter[created_from] and filter[created_to]', () => {
    const query = buildPaymentListQuery({ createdFrom: '2026-08-01', createdTo: '2026-08-31' }, undefined, {});
    expect(query).toContain('filter%5Bcreated_from%5D=2026-08-01');
    expect(query).toContain('filter%5Bcreated_to%5D=2026-08-31');
  });

  it('serializes filter[reconciliation_state]', () => {
    expect(buildPaymentListQuery({ reconciliationState: 'open' }, undefined, {})).toBe('?filter%5Breconciliation_state%5D=open');
  });

  it('serializes sort', () => {
    expect(buildPaymentListQuery({}, '-amount', {})).toBe('?sort=-amount');
  });

  it('omits sort when not set', () => {
    expect(buildPaymentListQuery({}, undefined, {})).toBe('');
  });

  it('serializes page[number] and page[size]', () => {
    expect(buildPaymentListQuery({}, undefined, { number: 2, size: 50 })).toBe('?page%5Bnumber%5D=2&page%5Bsize%5D=50');
  });

  it('omits page[number]/page[size] when not set, rather than sending 0', () => {
    expect(buildPaymentListQuery({}, undefined, { number: undefined, size: undefined })).toBe('');
  });

  it('combines search, multiple filters, sort and page params with &', () => {
    const query = buildPaymentListQuery({ search: 'DES-1', status: 'paid' }, '-created_at', { number: 2, size: 10 });
    expect(query).toBe('?search=DES-1&filter%5Bstatus%5D=paid&sort=-created_at&page%5Bnumber%5D=2&page%5Bsize%5D=10');
  });
});
