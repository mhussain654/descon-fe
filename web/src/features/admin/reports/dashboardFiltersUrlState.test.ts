import { describe, expect, it } from 'vitest';
import { readDashboardFiltersFromSearchParams, writeDashboardFiltersToSearchParams } from './dashboardFiltersUrlState';

describe('dashboardFiltersUrlState', () => {
  it('reads no filters from empty search params', () => {
    expect(readDashboardFiltersFromSearchParams(new URLSearchParams())).toEqual({
      countryCode: undefined,
      projectCode: undefined,
      craftCode: undefined,
    });
  });

  it('round-trips country/project/craft filters through the URL', () => {
    const filters = { countryCode: 'pk', projectCode: 'lng', craftCode: 'welder' };

    const params = writeDashboardFiltersToSearchParams(filters);

    expect(params.toString()).toBe('country=pk&project=lng&craft=welder');
    expect(readDashboardFiltersFromSearchParams(params)).toEqual(filters);
  });

  it('round-trips the registered date range and drops a malformed day', () => {
    const params = writeDashboardFiltersToSearchParams({ countryCode: 'qatar', registeredFrom: '2026-11-20', registeredTo: '2026-11-21' });
    expect(params.toString()).toBe('country=qatar&registered_from=2026-11-20&registered_to=2026-11-21');
    expect(readDashboardFiltersFromSearchParams(params)).toEqual({ countryCode: 'qatar', registeredFrom: '2026-11-20', registeredTo: '2026-11-21' });
    expect(readDashboardFiltersFromSearchParams(new URLSearchParams('registered_from=soon')).registeredFrom).toBeUndefined();
  });

  it('omits unset filters when writing to search params', () => {
    const params = writeDashboardFiltersToSearchParams({ countryCode: 'pk' });

    expect(params.toString()).toBe('country=pk');
  });
});
