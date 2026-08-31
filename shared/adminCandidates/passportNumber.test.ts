import { isValidPassportNumber, normalizePassportNumber } from './passportNumber';

describe('normalizePassportNumber', () => {
  it('uppercases and strips whitespace', () => {
    expect(normalizePassportNumber('ab 123456')).toBe('AB123456');
  });

  it('produces an empty string for blank input', () => {
    expect(normalizePassportNumber('   ')).toBe('');
  });
});

describe('isValidPassportNumber', () => {
  it('treats a blank value as valid -- passport number is optional', () => {
    expect(isValidPassportNumber('')).toBe(true);
  });

  it('accepts letters, digits and hyphens', () => {
    expect(isValidPassportNumber('AB123456')).toBe(true);
    expect(isValidPassportNumber('AB-123456')).toBe(true);
  });

  it('rejects a value with spaces or other punctuation (i.e. was not normalized first)', () => {
    expect(isValidPassportNumber('AB 123456')).toBe(false);
    expect(isValidPassportNumber('AB123456!')).toBe(false);
  });
});
