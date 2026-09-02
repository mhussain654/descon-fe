import { DEFAULT_PAGE_SIZE, readCandidateListStateFromSearchParams, writeCandidateListStateToSearchParams } from './candidateListUrlState';

describe('candidateListUrlState', () => {
  it('falls back to no filters/sort and page 1/default size when the URL has no params', () => {
    const state = readCandidateListStateFromSearchParams(new URLSearchParams());
    expect(state.filters).toEqual({ search: undefined, status: undefined, countryCode: undefined, projectCode: undefined, craftCode: undefined });
    expect(state.sort).toBeUndefined();
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });

  it('reads search, status, country, project, craft, sort and page from the URL', () => {
    const params = new URLSearchParams(
      'search=Jane&status=fee_pending&country=qatar&project=qatar_infrastructure&craft=electrician&sort=-created_at&page=3&size=50'
    );
    const state = readCandidateListStateFromSearchParams(params);
    expect(state.filters).toEqual({
      search: 'Jane',
      status: 'fee_pending',
      countryCode: 'qatar',
      projectCode: 'qatar_infrastructure',
      craftCode: 'electrician',
    });
    expect(state.sort).toBe('-created_at');
    expect(state.page).toEqual({ number: 3, size: 50 });
  });

  it('drops an unrecognized status code rather than forwarding it to the backend', () => {
    const state = readCandidateListStateFromSearchParams(new URLSearchParams('status=not_a_real_stage'));
    expect(state.filters.status).toBeUndefined();
  });

  it('drops an unrecognized sort value rather than forwarding it to the backend', () => {
    const state = readCandidateListStateFromSearchParams(new URLSearchParams('sort=not_a_real_sort'));
    expect(state.sort).toBeUndefined();
  });

  it('falls back to page 1 for an invalid or negative page number', () => {
    expect(readCandidateListStateFromSearchParams(new URLSearchParams('page=-5')).page.number).toBe(1);
    expect(readCandidateListStateFromSearchParams(new URLSearchParams('page=abc')).page.number).toBe(1);
  });

  it('omits search/filters/sort from the URL when unset', () => {
    const params = writeCandidateListStateToSearchParams({}, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(Array.from(params.keys())).toEqual([]);
  });

  it('omits page/size from the URL when they are page 1 / the default size', () => {
    const params = writeCandidateListStateToSearchParams({ search: 'Jane' }, undefined, { number: 1, size: DEFAULT_PAGE_SIZE });
    expect(params.has('page')).toBe(false);
    expect(params.has('size')).toBe(false);
  });

  it('writes every set filter, sort and non-default page/size explicitly', () => {
    const params = writeCandidateListStateToSearchParams(
      { search: 'Jane', status: 'verified', countryCode: 'qatar', projectCode: 'qatar_infrastructure', craftCode: 'electrician' },
      'full_name',
      { number: 2, size: 50 }
    );
    expect(params.get('search')).toBe('Jane');
    expect(params.get('status')).toBe('verified');
    expect(params.get('country')).toBe('qatar');
    expect(params.get('project')).toBe('qatar_infrastructure');
    expect(params.get('craft')).toBe('electrician');
    expect(params.get('sort')).toBe('full_name');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
  });

  it('round-trips through read -> write -> read unchanged', () => {
    const original = readCandidateListStateFromSearchParams(
      new URLSearchParams('search=Jane&status=fee_pending&country=qatar&sort=-full_name&page=2&size=50')
    );
    const written = writeCandidateListStateToSearchParams(original.filters, original.sort, original.page);
    const roundTripped = readCandidateListStateFromSearchParams(written);
    expect(roundTripped).toEqual(original);
  });
});
