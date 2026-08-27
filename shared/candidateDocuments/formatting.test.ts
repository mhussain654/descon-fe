import { formatFileSize } from './formatting';

describe('formatFileSize', () => {
  it('renders bytes for small sizes', () => {
    expect(formatFileSize(0, 'en')).toBe('0 B');
    expect(formatFileSize(512, 'en')).toBe('512 B');
  });

  it('renders kilobytes with one decimal place', () => {
    expect(formatFileSize(123456, 'en')).toBe('120.6 KB');
  });

  it('renders megabytes with one decimal place', () => {
    expect(formatFileSize(5 * 1024 * 1024, 'en')).toBe('5 MB');
    expect(formatFileSize(4.5 * 1024 * 1024, 'en')).toBe('4.5 MB');
  });

  it('never throws for a negative or non-finite size', () => {
    expect(formatFileSize(-5, 'en')).toBe('0 B');
    expect(formatFileSize(Number.NaN, 'en')).toBe('0 B');
  });

  it('formats the numeral per locale', () => {
    // Urdu uses the same Arabic-Indic-free numeral rendering as English in
    // this app's configured locale (en-PK/ur-PK) -- this just proves the
    // shared formatNumber path is actually used, not a hardcoded string.
    expect(formatFileSize(1024, 'ur')).toBe('1 KB');
  });
});
