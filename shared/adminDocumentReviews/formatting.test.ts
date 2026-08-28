import { formatFileSize, formatReviewDateTime, referenceDisplayName } from './formatting';

describe('formatReviewDateTime', () => {
  it('formats a valid ISO 8601 timestamp', () => {
    const result = formatReviewDateTime('2026-08-26T12:00:00Z', 'en');
    expect(result).toBeTruthy();
    expect(result).not.toBe('');
  });

  it('returns an empty string for undefined rather than throwing', () => {
    expect(formatReviewDateTime(undefined, 'en')).toBe('');
  });

  it('returns an empty string for an empty string', () => {
    expect(formatReviewDateTime('', 'en')).toBe('');
  });

  it('returns an empty string for an unparseable value rather than throwing', () => {
    expect(() => formatReviewDateTime('not-a-date', 'en')).not.toThrow();
    expect(formatReviewDateTime('not-a-date', 'en')).toBe('');
  });

  it('formats in Urdu without throwing', () => {
    expect(() => formatReviewDateTime('2026-08-26T12:00:00Z', 'ur')).not.toThrow();
    expect(formatReviewDateTime('2026-08-26T12:00:00Z', 'ur')).not.toBe('');
  });
});

describe('formatFileSize (re-exported from candidateDocuments/formatting)', () => {
  it('is available from this module for admin document metadata display', () => {
    expect(formatFileSize(1024, 'en')).toBe('1 KB');
  });
});

describe('referenceDisplayName', () => {
  it('returns the name when present', () => {
    expect(referenceDisplayName({ code: 'SA', name: 'Saudi Arabia' }, 'Name unavailable')).toBe('Saudi Arabia');
  });

  it('returns the fallback, never the raw code, when the name is missing', () => {
    expect(referenceDisplayName({ code: 'SA', name: '' }, 'Name unavailable')).toBe('Name unavailable');
  });
});
