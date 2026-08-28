import { PCC_REQUIREMENT_CODE, validatePccIssueDate } from './pccIssueDate';

describe('validatePccIssueDate', () => {
  const today = new Date('2026-08-28T12:00:00Z');

  it('requires a value', () => {
    expect(validatePccIssueDate('', today)).toBe('REQUIRED');
    expect(validatePccIssueDate('   ', today)).toBe('REQUIRED');
  });

  it('rejects a value that is not YYYY-MM-DD', () => {
    expect(validatePccIssueDate('28-08-2026', today)).toBe('INVALID_FORMAT');
    expect(validatePccIssueDate('2026/08/28', today)).toBe('INVALID_FORMAT');
    expect(validatePccIssueDate('not-a-date', today)).toBe('INVALID_FORMAT');
  });

  it('rejects an impossible calendar date', () => {
    expect(validatePccIssueDate('2026-02-30', today)).toBe('INVALID_FORMAT');
  });

  it('rejects a date in the future', () => {
    expect(validatePccIssueDate('2026-08-29', today)).toBe('IN_FUTURE');
  });

  it('accepts today', () => {
    expect(validatePccIssueDate('2026-08-28', today)).toBeNull();
  });

  it('accepts a valid past date', () => {
    expect(validatePccIssueDate('2026-08-01', today)).toBeNull();
  });
});

describe('PCC_REQUIREMENT_CODE', () => {
  it('matches the backend requirement code exactly', () => {
    expect(PCC_REQUIREMENT_CODE).toBe('police_character');
  });
});
