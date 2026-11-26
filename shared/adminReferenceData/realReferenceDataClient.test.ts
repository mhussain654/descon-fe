import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createReferenceDataClient } from './realReferenceDataClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Seen = { url: string; method?: string; body?: unknown; headers: Record<string, string> };

function respondWith(status: number, body: unknown, seen: Seen[] = []) {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return seen;
}

const envelope = (data: unknown) => ({ data, meta: { request_id: 'req-1', timestamp: '2026-11-26T09:00:00Z' }, errors: [] });

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
  createReferenceDataClient({
    apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }),
    staffAuthClient: fakeStaffAuthClient(),
    getLocale: () => 'en',
    newIdempotencyKey: () => 'idem-1',
  });

const craftPayload = {
  code: 'welder',
  name: 'Welder',
  name_en: 'Welder',
  name_ur: 'ویلڈر',
  active: false,
  updated_at: '2026-11-26T09:00:00Z',
  is_driver: false,
};

describe('reference data client', () => {
  it('lists every craft, retired ones too', async () => {
    const seen = respondWith(200, envelope([craftPayload]));

    const crafts = await buildClient().listLookups('crafts');

    expect(seen[0].url).toBe('http://example.test/api/v1/admin/crafts?include_retired=true');
    expect(crafts).toEqual([
      { code: 'welder', name: 'Welder', nameEn: 'Welder', nameUr: 'ویلڈر', active: false, updatedAt: '2026-11-26T09:00:00Z', isDriver: false },
    ]);
  });

  it('creates with an idempotency key and trimmed names', async () => {
    const seen = respondWith(201, envelope(craftPayload));

    await buildClient().createLookup('crafts', { code: ' welder ', nameEn: ' Welder ', nameUr: 'ویلڈر', isDriver: true });

    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: 'http://example.test/api/v1/admin/crafts',
      body: { reference_data: { code: 'welder', name_en: 'Welder', name_ur: 'ویلڈر', is_driver: true } },
    });
    expect(seen[0].headers['Idempotency-Key']).toBe('idem-1');
  });

  it('updates names with the last-seen timestamp and never sends the code', async () => {
    const seen = respondWith(200, envelope(craftPayload));

    await buildClient().updateLookup('countries', 'qatar', { code: 'x', nameEn: 'Qatar', nameUr: 'قطر' }, '2026-11-26T09:00:00Z');

    expect(seen[0]).toMatchObject({
      method: 'PATCH',
      url: 'http://example.test/api/v1/admin/countries/qatar',
      body: { reference_data: { name_en: 'Qatar', name_ur: 'قطر', expected_updated_at: '2026-11-26T09:00:00Z' } },
    });
    expect((seen[0].body as { reference_data: Record<string, unknown> }).reference_data).not.toHaveProperty('code');
  });

  it('retires, restores and deletes by code', async () => {
    const seen = respondWith(200, envelope(craftPayload));
    const client = buildClient();

    await client.retireLookup('projects', 'p1');
    await client.restoreLookup('projects', 'p1');
    await client.deleteLookup('projects', 'p1');

    expect(seen.map((request) => `${request.method} ${request.url}`)).toEqual([
      'POST http://example.test/api/v1/admin/projects/p1/retirement',
      'POST http://example.test/api/v1/admin/projects/p1/restoration',
      'DELETE http://example.test/api/v1/admin/projects/p1',
    ]);
  });

  it('reports an entry in use as IN_USE with the server message', async () => {
    respondWith(422, { errors: [{ code: 'reference_data_in_use', message: 'This is in use.' }] });

    await expect(buildClient().deleteLookup('countries', 'qatar')).rejects.toEqual({ code: 'IN_USE', message: 'This is in use.' });
  });

  it('reports a stale edit as STALE', async () => {
    respondWith(409, { errors: [{ code: 'stale_reference_data', message: 'Changed by someone else.' }] });

    await expect(buildClient().updateLookup('crafts', 'welder', { nameEn: 'a', nameUr: 'b' }, 't')).rejects.toMatchObject({ code: 'STALE' });
  });

  it('reads and saves the role permissions matrix', async () => {
    const matrix = {
      roles: [{ code: 'hr', name: 'HR', locked: false }],
      permissions: [{ code: 'view_job_logs', name: 'View job logs', developer_only: true }],
      grants: { hr: [] },
    };
    const seen = respondWith(200, envelope(matrix));
    const client = buildClient();

    expect(await client.getRolePermissions()).toEqual({
      roles: [{ code: 'hr', name: 'HR', locked: false }],
      permissions: [{ code: 'view_job_logs', name: 'View job logs', developerOnly: true }],
      grants: { hr: [] },
    });
    await client.setRolePermissions('hr', ['view_candidates']);

    expect(seen[1]).toMatchObject({
      method: 'PATCH',
      url: 'http://example.test/api/v1/admin/role_permissions/hr',
      body: { role_permission: { permission_codes: ['view_candidates'] } },
    });
  });

  it('reads the checklist and edits a row', async () => {
    const row = {
      id: 12,
      document_type: { code: 'passport', name: 'Passport' },
      country: null,
      project: null,
      craft: null,
      driver_only: false,
      requirement_level: 'required',
      active: true,
      minimum_files: 1,
      maximum_files: 2,
      accepted_content_types: ['application/pdf'],
      instructions_en: null,
      instructions_ur: 'اپ لوڈ کریں',
      updated_at: '2026-11-26T09:00:00Z',
    };
    const seen = respondWith(200, envelope({ requirements: [row], document_types: [], content_types: ['application/pdf'] }));
    const client = buildClient();

    const data = await client.getChecklist();
    expect(data.requirements[0]).toMatchObject({ id: '12', requirementLevel: 'required', instructionsEn: '', instructionsUr: 'اپ لوڈ کریں' });

    respondWith(200, envelope(row), seen);
    await client.updateRequirement('12', { active: false, maximumFiles: 3 }, '2026-11-26T09:00:00Z');
    expect(seen[1]).toMatchObject({
      method: 'PATCH',
      url: 'http://example.test/api/v1/admin/document_requirements/12',
      body: { document_requirement: { active: false, maximum_files: 3, expected_updated_at: '2026-11-26T09:00:00Z' } },
    });
  });

  it('adds a document to the common checklist with an idempotency key', async () => {
    const seen = respondWith(201, envelope({
      id: 3, document_type: { code: 'pcc', name: 'PCC' }, country: null, project: null, craft: null, driver_only: false,
      requirement_level: 'optional', active: true, minimum_files: 1, maximum_files: 1, accepted_content_types: ['application/pdf'],
      instructions_en: null, instructions_ur: null, updated_at: '2026-11-26T09:00:00Z',
    }));

    await buildClient().createRequirement({ documentTypeCode: 'pcc', countryCode: null, requirementLevel: 'optional' });

    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: { document_requirement: { document_type_code: 'pcc', country_code: null, requirement_level: 'optional' } },
    });
    expect(seen[0].headers['Idempotency-Key']).toBe('idem-1');
  });

  it('renames a stage and lists processes', async () => {
    const stage = { code: 'medical_fit', position: 10, name: 'Fit', default_name_en: 'Medical fit', default_name_ur: 'فٹ', name_en: 'Fit', name_ur: null };
    const seen = respondWith(200, envelope(stage));
    const client = buildClient();

    expect(await client.updateWorkflowStage('medical_fit', { nameEn: ' Fit ', nameUr: '' })).toMatchObject({ nameEn: 'Fit', defaultNameEn: 'Medical fit' });
    expect(seen[0].body).toEqual({ workflow_stage: { name_en: 'Fit', name_ur: '' } });

    respondWith(200, envelope([{ code: 'qatar', version: 1, status: 'active', country: null, published_at: null, stages: [] }]), seen);
    expect(await client.listMobilizationProcesses()).toEqual([
      { code: 'qatar', version: 1, status: 'active', country: null, publishedAt: null, stages: [] },
    ]);
  });
});
