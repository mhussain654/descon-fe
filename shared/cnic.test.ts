// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { formatCnic, isValidCnic, toCnicDigits } from './cnic';

describe('formatCnic / toCnicDigits', () => {
  it('groups 13 digits as 5-7-1', () => {
    expect(formatCnic('1234512345671')).toBe('12345-1234567-1');
  });

  it('formats a partial value without trailing dashes', () => {
    expect(formatCnic('12345')).toBe('12345');
    expect(formatCnic('123456')).toBe('12345-6');
  });

  it('strips non-digit characters and caps at 13 digits', () => {
    expect(toCnicDigits('12345-1234567-1extra')).toBe('1234512345671');
  });
});

describe('isValidCnic', () => {
  it('accepts exactly 13 digits', () => {
    expect(isValidCnic('1234512345671')).toBe(true);
  });

  it('rejects anything shorter, longer, empty or non-numeric', () => {
    expect(isValidCnic('123451234567')).toBe(false);
    expect(isValidCnic('12345123456712')).toBe(false);
    expect(isValidCnic('')).toBe(false);
    expect(isValidCnic('1234512345a71')).toBe(false);
  });
});
