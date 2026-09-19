// Pure translation between a dashboard's URL search params and its typed
// country/project/craft filter state -- kept separate from the component so
// "does a refresh/back/forward restore filters" is directly unit-testable
// without mounting a router, mirroring
// web/src/features/admin/candidates/candidateListUrlState.ts's identical
// rationale and structure. Shared by every admin dashboard (Admin/MPS/...)
// that accepts the same filter vocabulary, not duplicated per dashboard.
import type { DashboardFilters } from '../../../../../shared/adminReports/types';

/** Reads a dashboard's country/project/craft filters from URL search params. An absent filter genuinely means "show every candidate". */
export function readDashboardFiltersFromSearchParams(searchParams: URLSearchParams): DashboardFilters {
  return {
    countryCode: searchParams.get('country') || undefined,
    projectCode: searchParams.get('project') || undefined,
    craftCode: searchParams.get('craft') || undefined,
  };
}

/** Builds the URL search params for a given filter state -- the inverse of `readDashboardFiltersFromSearchParams`. */
export function writeDashboardFiltersToSearchParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.countryCode) params.set('country', filters.countryCode);
  if (filters.projectCode) params.set('project', filters.projectCode);
  if (filters.craftCode) params.set('craft', filters.craftCode);

  return params;
}
