import { createApiClient } from '../api-client';
import { createCandidateFlightDetailClient } from './realCandidateFlightDetailClient';

const originalFetch = globalThis.fetch;
function stubFetch(impl: typeof fetch) {
  globalThis.fetch = impl as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function successEnvelope(data: unknown) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string }>) {
  return { errors, request_id: 'req-1', timestamp: '2026-09-15T10:00:00Z' };
}

function flightDetailPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
    airline: 'Qatar Airways',
    flight_number: 'QR-123',
    sector: 'LHE-DOH',
    flight_departure_at: '2026-09-20T14:30:00Z',
    ticket_attached: true,
    mobilized_on: null,
    mobilized: false,
    ...overrides,
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  return createCandidateFlightDetailClient({ apiClient, getLocale: () => locale });
}

describe('createCandidateFlightDetailClient (real) -- getFlightDetail', () => {
  it('fetches with the bearer token and locale headers', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init as RequestInit)?.headers as Record<string, string>;
      return jsonResponse(successEnvelope(flightDetailPayload()));
    });

    const client = buildClient('ur');
    await client.getFlightDetail('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/flight_detail');
    expect(seenHeaders.Authorization).toBe('Bearer candidate-access-token');
    expect(seenHeaders['X-Locale']).toBe('ur');
  });

  it('resolves null when no flight detail has been recorded yet, not an error', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(null)));

    const client = buildClient();
    await expect(client.getFlightDetail('token')).resolves.toBeNull();
  });

  it('maps a recorded flight detail, snake_case to camelCase', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(flightDetailPayload())));

    const client = buildClient();
    const detail = await client.getFlightDetail('token');

    expect(detail).toEqual({
      id: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
      airline: 'Qatar Airways',
      flightNumber: 'QR-123',
      sector: 'LHE-DOH',
      flightDepartureAt: '2026-09-20T14:30:00Z',
      ticketAttached: true,
      mobilizedOn: null,
      mobilized: false,
    });
  });

  it('maps mobilized_on and mobilized once recorded', async () => {
    stubFetch(async () => jsonResponse(successEnvelope(flightDetailPayload({ mobilized_on: '2026-09-25', mobilized: true }))));

    const client = buildClient();
    const detail = await client.getFlightDetail('token');

    expect(detail?.mobilizedOn).toBe('2026-09-25');
    expect(detail?.mobilized).toBe(true);
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Session expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.getFlightDetail('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 403 inactive_account to INACTIVE_ACCOUNT', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'inactive_account', message: 'Inactive.' }]), { status: 403 }));

    const client = buildClient();
    await expect(client.getFlightDetail('token')).rejects.toEqual({ code: 'INACTIVE_ACCOUNT', message: 'Inactive.' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.getFlightDetail('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});

describe('createCandidateFlightDetailClient (real) -- requestTicketAccess', () => {
  it('POSTs with the bearer token and locale headers, and maps the response', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    stubFetch(async (url, init) => {
      seenUrl = String(url);
      seenInit = init as RequestInit;
      return jsonResponse(
        successEnvelope({
          flight_detail_id: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
          url: '/rails/active_storage/blobs/proxy/abc/ticket.pdf',
          expires_at: '2026-09-15T10:05:00Z',
        })
      );
    });

    const client = buildClient('ur');
    const access = await client.requestTicketAccess('candidate-access-token');

    expect(seenUrl).toBe('http://example.test/api/v1/candidate/flight_detail/ticket_access');
    expect(seenInit?.method).toBe('POST');
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer candidate-access-token');
    expect(headers['X-Locale']).toBe('ur');
    expect(access).toEqual({
      flightDetailId: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
      url: '/rails/active_storage/blobs/proxy/abc/ticket.pdf',
      expiresAt: '2026-09-15T10:05:00Z',
    });
  });

  it('maps a 404 to NOT_FOUND', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'not_found', message: 'Flight detail not found.' }]), { status: 404 }));

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'NOT_FOUND', message: 'Flight detail not found.' });
  });

  it('maps a 422 document_attachment_missing to TICKET_NOT_ATTACHED', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'document_attachment_missing', message: 'No ticket attached.' }]), { status: 422 })
    );

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'TICKET_NOT_ATTACHED', message: 'No ticket attached.' });
  });

  it('maps a 401 to SESSION_EXPIRED', async () => {
    stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'unauthorized', message: 'Expired.' }]), { status: 401 }));

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'SESSION_EXPIRED' });
  });

  it('maps a 429 to RATE_LIMITED with the Retry-After seconds', async () => {
    stubFetch(async () =>
      jsonResponse(errorEnvelope([{ code: 'rate_limited', message: 'Too many requests.' }]), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '20' },
      })
    );

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'RATE_LIMITED', retryAfterSeconds: 20 });
  });

  it('maps a 5xx to SERVER_ERROR', async () => {
    stubFetch(async () => new Response('Internal Server Error', { status: 500 }));

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'SERVER_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const client = buildClient();
    await expect(client.requestTicketAccess('token')).rejects.toEqual({ code: 'NETWORK_ERROR' });
  });
});
