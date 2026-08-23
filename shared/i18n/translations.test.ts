// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { translations } from './translations';

describe('translations', () => {
  it('defines the exact same set of keys for English and Urdu', () => {
    const enKeys = Object.keys(translations.en).sort();
    const urKeys = Object.keys(translations.ur).sort();
    expect(urKeys).toEqual(enKeys);
  });

  it('never ships an empty string for a translated value', () => {
    for (const entries of Object.values(translations)) {
      for (const value of Object.values(entries)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
