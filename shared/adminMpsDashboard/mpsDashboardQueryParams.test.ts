import { describe, expect, it } from 'vitest';
import { buildMpsDashboardQuery } from './mpsDashboardQueryParams';

describe('buildMpsDashboardQuery', () => {
  it('returns an empty string when no granularity or filter is set', () => {
    expect(buildMpsDashboardQuery({})).toBe('');
  });

  it('serializes granularity alone', () => {
    expect(buildMpsDashboardQuery({}, 'daily')).toBe('?granularity=daily');
  });

  it('serializes filters alone', () => {
    expect(buildMpsDashboardQuery({ countryCode: 'pk' })).toBe('?filter%5Bcountry_code%5D=pk');
  });

  it('serializes granularity and filters together, granularity first', () => {
    const query = buildMpsDashboardQuery({ countryCode: 'pk', projectCode: 'lng' }, 'weekly');

    expect(query).toBe('?granularity=weekly&filter%5Bcountry_code%5D=pk&filter%5Bproject_code%5D=lng');
  });
});
