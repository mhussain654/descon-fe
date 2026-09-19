// Pure translation between the admin dashboard's URL search params and its
// typed filter state -- kept separate from the component so "does a
// refresh/back/forward restore filters" is directly unit-testable without
// mounting a router, mirroring
// web/src/features/admin/candidates/candidateListUrlState.ts's identical
// rationale and structure.
import type { AdminDashboardFilters } from '../../../lib/admin-dashboard-client';

/** Reads the dashboard's country/project/craft filters from URL search params. An absent filter genuinely means "show every candidate". */
export function readDashboardFiltersFromSearchParams(searchParams: URLSearchParams): AdminDashboardFilters {
  return {
    countryCode: searchParams.get('country') || undefined,
    projectCode: searchParams.get('project') || undefined,
    craftCode: searchParams.get('craft') || undefined,
  };
}

/** Builds the URL search params for a given filter state -- the inverse of `readDashboardFiltersFromSearchParams`. */
export function writeDashboardFiltersToSearchParams(filters: AdminDashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.countryCode) params.set('country', filters.countryCode);
  if (filters.projectCode) params.set('project', filters.projectCode);
  if (filters.craftCode) params.set('craft', filters.craftCode);

  return params;
}
