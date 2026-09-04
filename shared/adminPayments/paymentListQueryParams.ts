// Pure query-string builder for GET /api/v1/admin/payments (the finance
// transaction list). Kept separate from the client so query-parameter
// serialization is directly unit-testable without mocking fetch, mirroring
// shared/adminCandidateImport/historyQueryParams.ts's identical rationale.
import type { PaymentListFilters, PaymentListPage, PaymentListSort } from './types';

/** Rails' Rack::Utils.parse_nested_query accepts percent-encoded brackets the same as raw ones, so encodeURIComponent on the whole `filter[x]`/`page[x]` key is standard and safe here. */
function appendParam(params: string[], key: string, value: string): void {
  params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

/** Builds the query string for the payment transaction list endpoint. Omits any filter/sort/page value that isn't set, letting the backend apply its own defaults (created_at desc, page 1, size 20). */
export function buildPaymentListQuery(filters: PaymentListFilters, sort: PaymentListSort | undefined, page: PaymentListPage): string {
  const params: string[] = [];

  if (filters.search?.trim()) appendParam(params, 'search', filters.search.trim());
  if (filters.status) appendParam(params, 'filter[status]', filters.status);
  if (filters.providerCode) appendParam(params, 'filter[provider_code]', filters.providerCode);
  if (filters.paymentTypeCode) appendParam(params, 'filter[payment_type_code]', filters.paymentTypeCode);
  if (filters.currencyCode) appendParam(params, 'filter[currency_code]', filters.currencyCode);
  if (filters.createdFrom) appendParam(params, 'filter[created_from]', filters.createdFrom);
  if (filters.createdTo) appendParam(params, 'filter[created_to]', filters.createdTo);
  if (filters.reconciliationState) appendParam(params, 'filter[reconciliation_state]', filters.reconciliationState);
  if (sort) appendParam(params, 'sort', sort);
  if (page.number) appendParam(params, 'page[number]', String(page.number));
  if (page.size) appendParam(params, 'page[size]', String(page.size));

  return params.length > 0 ? `?${params.join('&')}` : '';
}
