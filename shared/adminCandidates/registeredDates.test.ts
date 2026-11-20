import { appendRegisteredDateParams, isIsoDay, readRegisteredDateRange, writeRegisteredDateRange } from './registeredDates';

describe('registeredDates', () => {
  it('accepts only real YYYY-MM-DD days', () => {
    expect(isIsoDay('2026-11-20')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('20/11/2026')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
  });

  it('serializes whichever bound is set', () => {
    const params: string[] = [];
    appendRegisteredDateParams(params, { registeredFrom: '2026-11-20', registeredTo: '2026-11-28' });
    expect(params).toEqual(['filter%5Bregistered_from%5D=2026-11-20', 'filter%5Bregistered_to%5D=2026-11-28']);

    const onlyTo: string[] = [];
    appendRegisteredDateParams(onlyTo, { registeredTo: '2026-11-28' });
    expect(onlyTo).toEqual(['filter%5Bregistered_to%5D=2026-11-28']);
  });

  it('round-trips through the URL and drops malformed days', () => {
    const params = new URLSearchParams();
    writeRegisteredDateRange(params, { registeredFrom: '2026-11-20', registeredTo: '2026-11-28' });
    expect(params.toString()).toBe('registered_from=2026-11-20&registered_to=2026-11-28');
    expect(readRegisteredDateRange(params)).toEqual({ registeredFrom: '2026-11-20', registeredTo: '2026-11-28' });
    expect(readRegisteredDateRange(new URLSearchParams('registered_from=yesterday'))).toEqual({ registeredFrom: undefined, registeredTo: undefined });
  });
});
