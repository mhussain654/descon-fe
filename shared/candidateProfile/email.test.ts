import { isAcceptableEmail, normalizeEmail } from './email';

describe('candidate email rules', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Name@Example.COM ')).toBe('name@example.com');
  });

  it('accepts a well-formed address or an empty one', () => {
    expect(isAcceptableEmail('name@example.com')).toBe(true);
    expect(isAcceptableEmail('  ')).toBe(true);
  });

  it('refuses malformed or too long addresses', () => {
    expect(isAcceptableEmail('name@example')).toBe(false);
    expect(isAcceptableEmail('name example@x.com')).toBe(false);
    expect(isAcceptableEmail('@example.com')).toBe(false);
    expect(isAcceptableEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});
