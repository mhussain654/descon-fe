import { DEFAULT_PAGE_SIZE, readMobilizationStateFromSearchParams, writeMobilizationStateToSearchParams } from './mobilizationUrlState';

describe('mobilizationUrlState', () => {
  it('reads every filter, the sort and the page, and round-trips them', () => {
    const params = new URLSearchParams(
      'search=Ali&flight_date=2026-11-20&mobilized_from=2026-11-21&mobilized_to=2026-11-23&boarding_pass=missing&status=not_confirmed&country=qatar&registered_from=2026-11-01&registered_to=2026-11-02&sort=departure_at&page=2&size=50'
    );
    const state = readMobilizationStateFromSearchParams(params);

    expect(state).toEqual({
      filters: {
        search: 'Ali',
        flightDate: '2026-11-20',
        mobilizedFrom: '2026-11-21',
        mobilizedTo: '2026-11-23',
        boardingPass: 'missing',
        status: 'not_confirmed',
        countryCode: 'qatar',
        registeredFrom: '2026-11-01',
        registeredTo: '2026-11-02',
      },
      sort: 'departure_at',
      page: { number: 2, size: 50 },
    });
    expect(writeMobilizationStateToSearchParams(state.filters, state.sort, state.page).toString()).toBe(params.toString());
  });

  it('drops values the backend would reject', () => {
    const state = readMobilizationStateFromSearchParams(new URLSearchParams('flight_date=20/11/2026&mobilized_from=21/11/2026&boarding_pass=maybe&status=flying&sort=full_name'));

    expect(state.filters).toEqual({});
    expect(state.sort).toBeUndefined();
    expect(state.page).toEqual({ number: 1, size: DEFAULT_PAGE_SIZE });
  });
});
