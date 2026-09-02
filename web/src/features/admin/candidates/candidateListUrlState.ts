// Pure translation between the candidate list's URL search params and its
// typed filter/sort/page state -- kept separate from the component so "does
// a refresh/back/forward preserve filters" is directly unit-testable
// without mounting a router, mirroring
// web/src/features/admin/documentReviews/queueUrlState.ts's identical
// rationale and structure.
import { CANONICAL_WORKFLOW_STAGE_CODES } from '../../../../../shared/adminWorkflow/canonicalStages';
import type { AdminCandidateListFilters, AdminCandidateListPage, AdminCandidateListSort } from '../../../lib/admin-candidates-client';

export const DEFAULT_PAGE_SIZE = 20;

const SORTS = ['created_at', '-created_at', 'full_name', '-full_name', 'reference_number', '-reference_number'] as const;

function isCandidateListSort(value: string): value is AdminCandidateListSort {
  return (SORTS as readonly string[]).includes(value);
}

function isKnownStageCode(value: string): boolean {
  return (CANONICAL_WORKFLOW_STAGE_CODES as readonly string[]).includes(value);
}

export interface CandidateListUrlState {
  filters: AdminCandidateListFilters;
  sort: AdminCandidateListSort | undefined;
  page: AdminCandidateListPage;
}

/**
 * Reads the list's search/filters/sort/page from URL search params. There is
 * no backend-default filter to fall back to here (unlike the document-review
 * queue's default status filter) -- an absent filter genuinely means "show
 * every candidate", matching Admin::Candidates::IndexQuery's own behavior
 * when a filter param is omitted. An unrecognized `status` value is dropped
 * rather than forwarded to the backend, which would otherwise reject it with
 * a 400 -- the same "never forward garbage" rule as an unrecognized status
 * chip on the document-review queue.
 */
export function readCandidateListStateFromSearchParams(searchParams: URLSearchParams): CandidateListUrlState {
  const status = searchParams.get('status');
  const sortParam = searchParams.get('sort');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));

  return {
    filters: {
      search: searchParams.get('search') || undefined,
      status: status && isKnownStageCode(status) ? status : undefined,
      countryCode: searchParams.get('country') || undefined,
      projectCode: searchParams.get('project') || undefined,
      craftCode: searchParams.get('craft') || undefined,
    },
    sort: sortParam && isCandidateListSort(sortParam) ? sortParam : undefined,
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given search/filter/sort/page state -- the inverse of `readCandidateListStateFromSearchParams`. Every set value is written explicitly (no "omit if it matches some default" cleverness for filters/sort), except page/size, which are omitted when they're already page 1 of the default size -- keeping the URL clean on first load. */
export function writeCandidateListStateToSearchParams(
  filters: AdminCandidateListFilters,
  sort: AdminCandidateListSort | undefined,
  page: AdminCandidateListPage
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.countryCode) params.set('country', filters.countryCode);
  if (filters.projectCode) params.set('project', filters.projectCode);
  if (filters.craftCode) params.set('craft', filters.craftCode);
  if (sort) params.set('sort', sort);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
