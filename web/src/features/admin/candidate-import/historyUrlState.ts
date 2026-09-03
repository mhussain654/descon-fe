// Pure translation between the import history list's URL search params and
// its typed filter/page state -- kept separate from the component so "does
// a refresh/back/forward preserve filters" is directly unit-testable
// without mounting a router, mirroring
// web/src/features/admin/documentReviews/queueUrlState.ts's identical
// rationale and structure.
import type { CandidateImportHistoryFilters, CandidateImportHistoryPage, CandidateImportStatus } from '../../../lib/candidate-import-client';

export const DEFAULT_PAGE_SIZE = 20;

const STATUSES: CandidateImportStatus[] = ['queued', 'processing', 'completed', 'partial', 'failed', 'invalidated'];

function isImportStatus(value: string): value is CandidateImportStatus {
  return (STATUSES as string[]).includes(value);
}

/** ISO 8601 date only (YYYY-MM-DD), matching Admin::CandidateImports::IndexQuery's own Date.iso8601 parsing -- an obviously-malformed value is dropped rather than forwarded to the backend, which would otherwise reject it with a 422. */
function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface HistoryUrlState {
  filters: CandidateImportHistoryFilters;
  page: CandidateImportHistoryPage;
}

/** Reads the history list's filters/page from URL search params. There is no backend-default filter to fall back to -- an absent filter genuinely means "show every status", matching the backend's own behavior when a filter param is omitted. */
export function readHistoryStateFromSearchParams(searchParams: URLSearchParams): HistoryUrlState {
  const status = searchParams.get('status');
  const createdFrom = searchParams.get('from');
  const createdTo = searchParams.get('to');
  const templateVersion = searchParams.get('templateVersion');
  const pageNumber = Number(searchParams.get('page'));
  const pageSize = Number(searchParams.get('size'));

  return {
    filters: {
      status: status && isImportStatus(status) ? status : undefined,
      createdFrom: createdFrom && isIsoDate(createdFrom) ? createdFrom : undefined,
      createdTo: createdTo && isIsoDate(createdTo) ? createdTo : undefined,
      templateVersion: templateVersion || undefined,
    },
    page: {
      number: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    },
  };
}

/** Builds the URL search params for a given filter/page state -- the inverse of `readHistoryStateFromSearchParams`. Page/size are omitted when they're already page 1 of the default size, keeping the URL clean on first load; every set filter is written explicitly. */
export function writeHistoryStateToSearchParams(filters: CandidateImportHistoryFilters, page: CandidateImportHistoryPage): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.createdFrom) params.set('from', filters.createdFrom);
  if (filters.createdTo) params.set('to', filters.createdTo);
  if (filters.templateVersion) params.set('templateVersion', filters.templateVersion);
  if (page.number && page.number !== 1) params.set('page', String(page.number));
  if (page.size && page.size !== DEFAULT_PAGE_SIZE) params.set('size', String(page.size));

  return params;
}
