import { buildDashboardQuery } from './dashboardQueryParams';

describe('buildDashboardQuery', () => {
  it('serializes the registered (import batch) date range with the country', () => {
    expect(buildDashboardQuery({ countryCode: 'qatar', registeredFrom: '2026-11-20', registeredTo: '2026-11-21' })).toBe(
      '?filter%5Bcountry_code%5D=qatar&filter%5Bregistered_from%5D=2026-11-20&filter%5Bregistered_to%5D=2026-11-21'
    );
  });

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
