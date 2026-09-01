import { isValidMobileNumber, normalizeMobileNumber } from './mobileNumber';

describe('normalizeMobileNumber', () => {
  it('strips whitespace and non-digit separators', () => {
    expect(normalizeMobileNumber(' 0300 123 4567 ')).toBe('03001234567');
    expect(normalizeMobileNumber('0300-123-4567')).toBe('03001234567');
  });

  it('preserves a leading + but strips it from the digit count otherwise', () => {
    expect(normalizeMobileNumber('+92 300 1234567')).toBe('+923001234567');
  });

  it('produces an empty string for blank input', () => {
    expect(normalizeMobileNumber('   ')).toBe('');
  });
});

describe('isValidMobileNumber', () => {
  it('accepts 10-15 digits, with or without a leading +', () => {
    expect(isValidMobileNumber('03001234567')).toBe(true);
    expect(isValidMobileNumber('+923001234567')).toBe(true);
  });

  it('rejects too few or too many digits', () => {
    expect(isValidMobileNumber('123456789')).toBe(false);
    expect(isValidMobileNumber('1234567890123456')).toBe(false);
  });

  it('rejects a value that still contains non-digit characters (i.e. was not normalized first)', () => {
    expect(isValidMobileNumber('0300-123-4567')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidMobileNumber('')).toBe(false);
  });
});
