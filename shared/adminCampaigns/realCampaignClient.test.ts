import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createCampaignClient } from './realCampaignClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Seen = { url: string; method?: string; body?: unknown };

function respondWith(status: number, body: unknown, seen: Seen[] = []) {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return seen;
}

const envelope = (data: unknown) => ({ data, meta: { request_id: 'req-1', timestamp: '2026-11-26T09:00:00Z' }, errors: [] });

const campaignPayload = {
  id: 'campaign-1',
  code: '2026-11-26-QATAR',
  name: '2026-11-26 Qatar',
  kind: 'regular',
  country: { code: 'qatar', name: 'Qatar' },
  active: true,
  created_at: '2026-11-26T09:00:00Z',
  candidate_count: 42,
};

function fakeStaffAuthClient(): StaffAuthClient {
  return {
    signIn: async () => {
      throw new Error('not used');
    },
    restoreSession: async () => null,
    signOut: async () => undefined,
    authenticatedRequest: async () => {
      throw new Error('not used');
    },
    authenticatedDataRequest: async (makeRequest) => makeRequest('staff-access-token'),
  } as StaffAuthClient;
}

const buildClient = () =>
  createCampaignClient({
    apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }),
    staffAuthClient: fakeStaffAuthClient(),
    getLocale: () => 'en',
  });

describe('campaign client', () => {
  it('lists campaigns with their counts, and asks for retired ones when told to', async () => {
    const seen = respondWith(200, envelope([campaignPayload]));

    const campaigns = await buildClient().listCampaigns({ includeRetired: true });

    expect(seen[0].url).toBe('http://example.test/api/v1/admin/campaigns?include_retired=true');
    expect(campaigns).toEqual([
      {
        id: 'campaign-1', code: '2026-11-26-QATAR', name: '2026-11-26 Qatar', kind: 'regular',
        country: { code: 'qatar', name: 'Qatar' }, active: true, createdAt: '2026-11-26T09:00:00Z', candidateCount: 42,
      },
    ]);
  });

  it('creates a campaign with its name, country and start date', async () => {
    const seen = respondWith(201, envelope(campaignPayload));

    await buildClient().createCampaign({ name: ' Quarterly payment ', countryCode: 'qatar', startDate: '2026-11-26' });

    expect(seen[0]).toMatchObject({
      url: 'http://example.test/api/v1/admin/campaigns',
      method: 'POST',
      body: { campaign: { name: 'Quarterly payment', country_code: 'qatar', start_date: '2026-11-26' } },
    });
  });

  it('reads and saves the running campaign on the profile', async () => {
    respondWith(200, envelope({ id: 'staff-1', selected_campaign: campaignPayload }));
    expect((await buildClient().getRunningCampaign())?.code).toBe('2026-11-26-QATAR');

    const seen = respondWith(200, envelope({ id: 'staff-1', selected_campaign: null }));
    expect(await buildClient().setRunningCampaign(null)).toBeNull();
    expect(seen[0]).toMatchObject({ method: 'PATCH', body: { profile: { selected_campaign_id: null } } });
  });

  it('maps a refused campaign to a field error with the localized message', async () => {
    respondWith(422, { errors: [{ code: 'validation_failed', message: 'Select a valid campaign.', field: 'profile.selected_campaign_id' }] });

    await expect(buildClient().setRunningCampaign('unknown')).rejects.toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Select a valid campaign.',
      field: 'profile.selected_campaign_id',
    });
  });
});
