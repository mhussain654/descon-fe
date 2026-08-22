// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { translate } from './translate';
import type { TranslationKey } from './translations';

describe('translate', () => {
  it('returns the English value for a known key', () => {
    expect(translate('en', 'continue')).toBe('Continue');
  });

  it('returns the Urdu value for a known key', () => {
    expect(translate('ur', 'continue')).toBe('جاری رکھیں');
  });

  it('falls back to the key itself and warns once for a missing key', () => {
    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };
    const missingKey = 'thisKeyDoesNotExist' as TranslationKey;

    expect(translate('en', missingKey)).toBe(missingKey);
    expect(translate('en', missingKey)).toBe(missingKey);
    expect(warnCalls.length).toBe(1);

    console.warn = originalWarn;
  });
});
