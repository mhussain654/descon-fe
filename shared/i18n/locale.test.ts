// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { formatCurrency, formatNumber, isRTL, toIntlLocale } from './locale';

describe('locale', () => {
  it('flags Urdu as right-to-left and English as left-to-right', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('en')).toBe(false);
  });

  it('maps each language to a BCP 47 locale', () => {
    expect(toIntlLocale('en')).toBe('en-PK');
    expect(toIntlLocale('ur')).toBe('ur-PK');
  });

  it('formats numbers using the locale-appropriate digit grouping', () => {
    expect(formatNumber(12345, 'en')).toBe('12,345');
  });

  it('formats currency with the PKR symbol by default', () => {
    expect(formatCurrency(25000, 'en')).toContain('25,000');
  });
});
