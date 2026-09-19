import { describe, expect, it } from 'vitest';
import { buildDashboardQuery } from './dashboardQueryParams';

describe('buildDashboardQuery', () => {
  it('returns an empty string when no filter is set', () => {
    expect(buildDashboardQuery({})).toBe('');
  });

  it('serializes each filter as filter[x]', () => {
    expect(buildDashboardQuery({ countryCode: 'pk' })).toBe('?filter%5Bcountry_code%5D=pk');
  });

  it('serializes multiple filters joined with &', () => {
    const query = buildDashboardQuery({ countryCode: 'pk', projectCode: 'lng', craftCode: 'welder' });

    expect(query).toBe('?filter%5Bcountry_code%5D=pk&filter%5Bproject_code%5D=lng&filter%5Bcraft_code%5D=welder');
  });
});
