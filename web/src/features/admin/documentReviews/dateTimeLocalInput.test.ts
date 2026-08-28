import { describe, expect, it } from 'vitest';
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from './dateTimeLocalInput';

describe('isoToDatetimeLocalValue', () => {
  it('returns an empty string for undefined', () => {
    expect(isoToDatetimeLocalValue(undefined)).toBe('');
  });

  it('returns an empty string for an unparseable value', () => {
    expect(isoToDatetimeLocalValue('not-a-date')).toBe('');
  });

  it('formats a valid ISO 8601 timestamp as a datetime-local value', () => {
    const value = isoToDatetimeLocalValue('2026-08-26T12:30:00Z');
    expect(value).toMatch(/^2026-08-26T\d{2}:30$/);
  });
});

describe('datetimeLocalValueToIso', () => {
  it('returns undefined for an empty string', () => {
    expect(datetimeLocalValueToIso('')).toBeUndefined();
  });

  it('converts a datetime-local value to a valid ISO 8601 string', () => {
    const iso = datetimeLocalValueToIso('2026-08-26T14:30');
    expect(iso).toBeTruthy();
    expect(() => new Date(iso as string).toISOString()).not.toThrow();
  });

  it('round-trips through iso -> local -> iso losslessly to the minute', () => {
    const original = '2026-08-26T12:30:00.000Z';
    const local = isoToDatetimeLocalValue(original);
    const roundTripped = datetimeLocalValueToIso(local);
    expect(new Date(roundTripped as string).getTime()).toBe(new Date(original).getTime());
  });
});
