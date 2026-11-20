import { flightDateToday, isFlightDate } from './flightDate';

describe('flightDateToday', () => {
  it('uses the calendar day in Pakistan, not UTC', () => {
    // 20:30 UTC on 19 Nov is already 01:30 on 20 Nov in Pakistan (UTC+5).
    expect(flightDateToday(new Date('2026-11-19T20:30:00Z'))).toBe('2026-11-20');
    expect(flightDateToday(new Date('2026-11-19T18:30:00Z'))).toBe('2026-11-19');
  });
});

describe('isFlightDate', () => {
  it('accepts a real YYYY-MM-DD date only', () => {
    expect(isFlightDate('2026-11-20')).toBe(true);
    expect(isFlightDate('2026-02-30')).toBe(false);
    expect(isFlightDate('20/11/2026')).toBe(false);
    expect(isFlightDate('')).toBe(false);
    expect(isFlightDate(null)).toBe(false);
  });
});
