import { buildMobilizationListQuery, toMobilizationRow, toMobilizationSummary } from './mobilizations';

describe('buildMobilizationListQuery', () => {
  it('omits everything unset', () => {
    expect(buildMobilizationListQuery({}, undefined, {})).toBe('');
  });

  it('serializes the country and registered (import batch) date range', () => {
    expect(buildMobilizationListQuery({ countryCode: 'qatar', registeredFrom: '2026-11-20', registeredTo: '2026-11-20' }, undefined, {})).toBe(
      '?filter%5Bcountry_code%5D=qatar&filter%5Bregistered_from%5D=2026-11-20&filter%5Bregistered_to%5D=2026-11-20'
    );
  });

  it('serializes search, every filter, sort and page', () => {
    expect(
      buildMobilizationListQuery(
        { search: 'Ali', flightDate: '2026-11-20', mobilizedFrom: '2026-11-21', mobilizedTo: '2026-11-23', boardingPass: 'missing', status: 'not_confirmed' },
        'departure_at',
        { number: 2, size: 50 }
      )
    ).toBe(
      '?search=Ali&filter%5Bflight_date%5D=2026-11-20&filter%5Bmobilized_from%5D=2026-11-21&filter%5Bmobilized_to%5D=2026-11-23&filter%5Bboarding_pass%5D=missing&filter%5Bstatus%5D=not_confirmed&sort=departure_at&page%5Bnumber%5D=2&page%5Bsize%5D=50'
    );
  });
});

describe('toMobilizationRow', () => {
  it('maps the backend row', () => {
    expect(
      toMobilizationRow({
        id: 'flight-1',
        candidate: { id: 'c-1', full_name: 'Ali Raza', registration_number: 'DES-1', country_name: 'Qatar', project_name: 'Qatar Infra', craft_name: 'Electrician' },
        airline: 'Qatar Airways',
        flight_number: 'QR-629',
        sector: 'LHE-DOH',
        flight_departure_at: '2026-11-19T21:00:00Z',
        ticket_attached: true,
        boarding_pass_uploaded_at: null,
        mobilized_on: null,
        status: 'departing_today',
      })
    ).toEqual({
      id: 'flight-1',
      candidate: { id: 'c-1', fullName: 'Ali Raza', registrationNumber: 'DES-1', countryName: 'Qatar', projectName: 'Qatar Infra', craftName: 'Electrician' },
      airline: 'Qatar Airways',
      flightNumber: 'QR-629',
      sector: 'LHE-DOH',
      flightDepartureAt: '2026-11-19T21:00:00Z',
      ticketAttached: true,
      boardingPassUploadedAt: null,
      boardingPassCheck: null,
      boardingPassRejected: false,
      mobilizedOn: null,
      status: 'departing_today',
    });
  });
});

describe('toMobilizationSummary', () => {
  it('maps the counts and zero-fills anything missing or malformed', () => {
    expect(toMobilizationSummary({ total: 300, boarding_pass: { uploaded: 180, missing: 120 }, status: { departing_today: 300 } })).toEqual({
      total: 300,
      boardingPass: { uploaded: 180, missing: 120 },
      status: { scheduled: 0, departing_today: 300, departed: 0, not_confirmed: 0 },
    });
    expect(toMobilizationSummary(null)).toEqual({ total: 0, boardingPass: { uploaded: 0, missing: 0 }, status: { scheduled: 0, departing_today: 0, departed: 0, not_confirmed: 0 } });
  });
});
