import { buildCandidateListQuery } from './candidateListQueryParams';

describe('buildCandidateListQuery', () => {
  it('returns an empty string when no filters, sort or page are set', () => {
    expect(buildCandidateListQuery({}, undefined, {})).toBe('');
  });

  it('serializes the free-text search param as a top-level `search`, never `filter[search]`', () => {
    expect(buildCandidateListQuery({ search: 'Jane' }, undefined, {})).toBe('?search=Jane');
  });

  it('serializes filter[status] as a single value, never comma-joined', () => {
    expect(buildCandidateListQuery({ status: 'fee_pending' }, undefined, {})).toBe('?filter%5Bstatus%5D=fee_pending');
  });

  it('serializes filter[country_code], filter[project_code] and filter[craft_code]', () => {
    const query = buildCandidateListQuery({ countryCode: 'qatar', projectCode: 'qatar_infrastructure', craftCode: 'electrician' }, undefined, {});
    expect(query).toContain('filter%5Bcountry_code%5D=qatar');
    expect(query).toContain('filter%5Bproject_code%5D=qatar_infrastructure');
    expect(query).toContain('filter%5Bcraft_code%5D=electrician');
  });

  it('serializes sort with its leading `-` for descending', () => {
    expect(buildCandidateListQuery({}, '-created_at', {})).toBe('?sort=-created_at');
  });

  it('omits sort entirely when unset, letting the backend apply its own default ordering', () => {
    expect(buildCandidateListQuery({}, undefined, {})).toBe('');
  });

  it('serializes page[number] and page[size]', () => {
    expect(buildCandidateListQuery({}, undefined, { number: 3, size: 50 })).toBe('?page%5Bnumber%5D=3&page%5Bsize%5D=50');
  });

  it('omits page[number]/page[size] when not set, rather than sending 0', () => {
    expect(buildCandidateListQuery({}, undefined, { number: undefined, size: undefined })).toBe('');
  });

  it('combines search, filters, sort and page params with &', () => {
    const query = buildCandidateListQuery({ search: 'Jane', status: 'verified' }, 'full_name', { number: 2, size: 20 });
    expect(query).toBe('?search=Jane&filter%5Bstatus%5D=verified&sort=full_name&page%5Bnumber%5D=2&page%5Bsize%5D=20');
  });

  it('URL-encodes special characters in filter values', () => {
    const query = buildCandidateListQuery({ search: 'a b&c' }, undefined, {});
    expect(query).toBe('?search=a%20b%26c');
  });
});
