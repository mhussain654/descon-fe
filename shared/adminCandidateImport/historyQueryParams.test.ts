import { buildImportHistoryQuery } from './historyQueryParams';

describe('buildImportHistoryQuery', () => {
  it('returns an empty string when no filters or page are set', () => {
    expect(buildImportHistoryQuery({}, {})).toBe('');
  });

  it('serializes filter[status] as a single value', () => {
    expect(buildImportHistoryQuery({ status: 'failed' }, {})).toBe('?filter%5Bstatus%5D=failed');
  });

  it('serializes filter[created_from] and filter[created_to]', () => {
    const query = buildImportHistoryQuery({ createdFrom: '2026-08-01', createdTo: '2026-08-31' }, {});
    expect(query).toContain('filter%5Bcreated_from%5D=2026-08-01');
    expect(query).toContain('filter%5Bcreated_to%5D=2026-08-31');
  });

  it('serializes filter[template_version]', () => {
    expect(buildImportHistoryQuery({ templateVersion: 'v1' }, {})).toBe('?filter%5Btemplate_version%5D=v1');
  });

  it('serializes page[number] and page[size]', () => {
    expect(buildImportHistoryQuery({}, { number: 2, size: 50 })).toBe('?page%5Bnumber%5D=2&page%5Bsize%5D=50');
  });

  it('omits page[number]/page[size] when not set, rather than sending 0', () => {
    expect(buildImportHistoryQuery({}, { number: undefined, size: undefined })).toBe('');
  });

  it('combines multiple filters and page params with &', () => {
    const query = buildImportHistoryQuery({ status: 'partial', templateVersion: 'v1' }, { number: 3, size: 10 });
    expect(query).toBe('?filter%5Bstatus%5D=partial&filter%5Btemplate_version%5D=v1&page%5Bnumber%5D=3&page%5Bsize%5D=10');
  });
});
