// Pure translation between the queue's URL search params and its typed
// filter/page state -- kept separate from the component so "does a refresh/
// back/forward preserve filters" is directly unit-testable without mounting
// a router.
import { FILTERABLE_QUEUE_STATUSES } from '../../../../../shared/adminDocumentReviews/statusLabels';
import type { DocumentReviewQueueFilters, DocumentReviewQueuePage, QueueStatusFilter, ReviewState } from '../../../../../shared/adminDocumentReviews/types';

export const DEFAULT_STATUS_FILTER: ReviewState[] = ['pending_review', 'partially_reviewed'];
export const DEFAULT_PAGE_SIZE = 20;

function isQueueStatusFilter(value: string): value is QueueStatusFilter {
  return (FILTERABLE_QUEUE_STATUSES as readonly string[]).includes(value);
}

export interface QueueUrlState {
  filters: DocumentReviewQueueFilters;
  page: DocumentReviewQueuePage;
}

/** Reads the queue's filters/page from URL search params, falling back to the backend's own default statuses (never a client-invented default) when `status` isn't present. */
export function readQueueStateFromSearchParams(searchParams: URLSearchParams): QueueUrlState {
  const statusParam = searchParams.get('status');
  const parsedStatuses = statusParam ? statusParam.split(',').filter(isQueueStatusFilter) : [];
  const status = parsedStatuses.length > 0 ? parsedStatuses : DEFAULT_STATUS_FILTER;

  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));

  return {
    filters: {
      status,
      candidatePublicId: searchParams.get('candidateId') || undefined,
      projectCode: searchParams.get('project') || undefined,
      countryCode: searchParams.get('country') || undefined,
      submittedFrom: searchParams.get('from') || undefined,
      submittedTo: searchParams.get('to') || undefined,
    },
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given filter/page state -- the inverse of `readQueueStateFromSearchParams`. Every set value is written explicitly (no "omit if it matches the default" cleverness) so the URL always reflects exactly what's active. */
export function writeQueueStateToSearchParams(filters: DocumentReviewQueueFilters, page: DocumentReviewQueuePage): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status && filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }
  if (filters.candidatePublicId) params.set('candidateId', filters.candidatePublicId);
  if (filters.projectCode) params.set('project', filters.projectCode);
  if (filters.countryCode) params.set('country', filters.countryCode);
  if (filters.submittedFrom) params.set('from', filters.submittedFrom);
  if (filters.submittedTo) params.set('to', filters.submittedTo);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
