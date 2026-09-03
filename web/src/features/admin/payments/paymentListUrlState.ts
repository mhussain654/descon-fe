// Pure translation between the payment transaction list's URL search params
// and its typed search/filter/sort/page state -- kept separate from the
// component so "does a refresh/back/forward restore filters" is directly
// unit-testable without mounting a router, mirroring
// web/src/features/admin/candidates/candidateListUrlState.ts's identical
// rationale and structure.
import type { AdminPaymentStatus, PaymentListFilters, PaymentListPage, PaymentListSort } from '../../../lib/admin-payments-client';

export const DEFAULT_PAGE_SIZE = 20;

const STATUSES = ['checkout_pending', 'paid', 'failed', 'cancelled'] as const;
const RECONCILIATION_STATES = ['clean', 'open', 'resolved'] as const;
const SORTS = ['created_at', '-created_at', 'paid_at', '-paid_at', 'amount', '-amount', 'status_code', '-status_code'] as const;

function isPaymentStatus(value: string): value is AdminPaymentStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isReconciliationState(value: string): value is NonNullable<PaymentListFilters['reconciliationState']> {
  return (RECONCILIATION_STATES as readonly string[]).includes(value);
}

function isPaymentListSort(value: string): value is PaymentListSort {
  return (SORTS as readonly string[]).includes(value);
}

/** ISO 8601 date only (YYYY-MM-DD), matching Admin::Payments::IndexQuery's own Date.iso8601 parsing -- an obviously-malformed value is dropped rather than forwarded to the backend, which would otherwise reject it with a 422. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface PaymentListUrlState {
  filters: PaymentListFilters;
  sort: PaymentListSort | undefined;
  page: PaymentListPage;
}

/**
 * Reads the transaction list's search/filters/sort/page from URL search
 * params. There is no backend-default filter to fall back to -- an absent
 * filter genuinely means "show every payment", matching
 * Admin::Payments::IndexQuery's own behavior when a filter param is
 * omitted. Any unrecognized enum value is dropped rather than forwarded to
 * the backend, which would otherwise reject it with a 400/422.
 */
export function readPaymentListStateFromSearchParams(searchParams: URLSearchParams): PaymentListUrlState {
  const status = searchParams.get('status');
  const reconciliationState = searchParams.get('reconciliation');
  const sortParam = searchParams.get('sort');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));
  const createdFrom = searchParams.get('from');
  const createdTo = searchParams.get('to');

  return {
    filters: {
      search: searchParams.get('search') || undefined,
      status: status && isPaymentStatus(status) ? status : undefined,
      providerCode: searchParams.get('provider') || undefined,
      paymentTypeCode: searchParams.get('type') || undefined,
      currencyCode: searchParams.get('currency') || undefined,
      createdFrom: createdFrom && isIsoDate(createdFrom) ? createdFrom : undefined,
      createdTo: createdTo && isIsoDate(createdTo) ? createdTo : undefined,
      reconciliationState: reconciliationState && isReconciliationState(reconciliationState) ? reconciliationState : undefined,
    },
    sort: sortParam && isPaymentListSort(sortParam) ? sortParam : undefined,
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given search/filter/sort/page state -- the inverse of `readPaymentListStateFromSearchParams`. Every set value is written explicitly, except page/size, which are omitted when they're already page 1 of the default size -- keeping the URL clean on first load. */
export function writePaymentListStateToSearchParams(
  filters: PaymentListFilters,
  sort: PaymentListSort | undefined,
  page: PaymentListPage
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.providerCode) params.set('provider', filters.providerCode);
  if (filters.paymentTypeCode) params.set('type', filters.paymentTypeCode);
  if (filters.currencyCode) params.set('currency', filters.currencyCode);
  if (filters.createdFrom) params.set('from', filters.createdFrom);
  if (filters.createdTo) params.set('to', filters.createdTo);
  if (filters.reconciliationState) params.set('reconciliation', filters.reconciliationState);
  if (sort) params.set('sort', sort);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
