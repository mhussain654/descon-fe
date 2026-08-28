import { buildDocumentReviewQueueQuery } from './queueQueryParams';

describe('buildDocumentReviewQueueQuery', () => {
  it('returns an empty string when no filters or page are set', () => {
    expect(buildDocumentReviewQueueQuery({}, {})).toBe('');
  });

  it('serializes filter[status] as a comma-joined list', () => {
    expect(buildDocumentReviewQueueQuery({ status: ['pending_review', 'verified'] }, {})).toBe(
      '?filter%5Bstatus%5D=pending_review%2Cverified'
    );
  });

  it('omits filter[status] entirely when empty, letting the backend apply its own default', () => {
    expect(buildDocumentReviewQueueQuery({ status: [] }, {})).toBe('');
  });

  it('serializes submitted_from and submitted_to', () => {
    const query = buildDocumentReviewQueueQuery(
      { submittedFrom: '2026-08-01T00:00:00Z', submittedTo: '2026-08-31T23:59:59Z' },
      {}
    );
    expect(query).toContain('filter%5Bsubmitted_from%5D=2026-08-01T00%3A00%3A00Z');
    expect(query).toContain('filter%5Bsubmitted_to%5D=2026-08-31T23%3A59%3A59Z');
  });

  it('serializes candidate_public_id, project_code and country_code', () => {
    const query = buildDocumentReviewQueueQuery(
      { candidatePublicId: 'cand-1', projectCode: 'PRJ-1', countryCode: 'SA' },
      {}
    );
    expect(query).toContain('filter%5Bcandidate_public_id%5D=cand-1');
    expect(query).toContain('filter%5Bproject_code%5D=PRJ-1');
    expect(query).toContain('filter%5Bcountry_code%5D=SA');
  });

  it('serializes page[number] and page[size]', () => {
    expect(buildDocumentReviewQueueQuery({}, { number: 3, size: 50 })).toBe(
      '?page%5Bnumber%5D=3&page%5Bsize%5D=50'
    );
  });

  it('omits page[number]/page[size] when not set, rather than sending 0', () => {
    expect(buildDocumentReviewQueueQuery({}, { number: undefined, size: undefined })).toBe('');
  });

  it('combines multiple filters and page params with &', () => {
    const query = buildDocumentReviewQueueQuery(
      { status: ['changes_required'], countryCode: 'PK' },
      { number: 2, size: 20 }
    );
    expect(query).toBe(
      '?filter%5Bstatus%5D=changes_required&filter%5Bcountry_code%5D=PK&page%5Bnumber%5D=2&page%5Bsize%5D=20'
    );
  });

  it('URL-encodes special characters in filter values', () => {
    const query = buildDocumentReviewQueueQuery({ candidatePublicId: 'a b&c' }, {});
    expect(query).toBe('?filter%5Bcandidate_public_id%5D=a%20b%26c');
  });
});
