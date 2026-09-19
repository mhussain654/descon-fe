import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createAdminWorkflowStageCallScriptsClient } from './realAdminWorkflowStageCallScriptsClient';

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

function successEnvelope(data: unknown, meta: Record<string, unknown> = {}) {
  return { data, meta: { request_id: 'req-1', timestamp: '2026-09-11T09:00:00Z', ...meta }, errors: [] };
}

function errorEnvelope(errors: Array<{ code: string; message: string; field?: string }>) {
  return { errors, request_id: 'req-1' };
}

function scriptPayload(overrides: Record<string, unknown> = {}) {
  return {
    workflow_stage_code: 'verified',
    announcement_en: 'Hello, this is Descon Manpower calling.',
    announcement_ur: null,
    active: false,
    updated_by: null,
    updated_at: '2026-09-11T09:00:00Z',
    ...overrides,
  };
}

/** A fake StaffAuthClient that just attaches a fixed token and rethrows whatever `makeRequest` throws -- authenticatedDataRequest's own refresh/401 behavior is covered separately in realStaffAuthClient.test.ts (same rationale as realAdminCandidateAiCallsClient.test.ts's identical fake). */
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
  };
}

function buildClient(locale: 'en' | 'ur' = 'en') {
  const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
  const staffAuthClient = fakeStaffAuthClient();
  const client = createAdminWorkflowStageCallScriptsClient({ apiClient, staffAuthClient, getLocale: () => locale });
  return { client };
}

describe('createAdminWorkflowStageCallScriptsClient (real)', () => {
  describe('listWorkflowStageCallScripts', () => {
    it('fetches the real backend list with auth/locale headers and maps the response', async () => {
      let seenUrl = '';
      let seenInit: RequestInit | undefined;
      stubFetch(async (url, init) => {
        seenUrl = String(url);
        seenInit = init as RequestInit;
        return jsonResponse(
          successEnvelope([
            scriptPayload({
              announcement_ur: 'السلام علیکم، یہ ڈیسکون مین پاور کی کال ہے۔',
              updated_by: { id: 'staff-1', role: 'admin' },
              active: true,
            }),
          ])
        );
      });

      const { client } = buildClient('ur');
      const result = await client.listWorkflowStageCallScripts();

      expect(seenUrl).toBe('http://example.test/api/v1/admin/workflow_stage_call_scripts');
      const headers = seenInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer staff-access-token');
      expect(headers['X-Locale']).toBe('ur');

      expect(result).toEqual([
        {
          workflowStageCode: 'verified',
          announcementEn: 'Hello, this is Descon Manpower calling.',
          announcementUr: 'السلام علیکم، یہ ڈیسکون مین پاور کی کال ہے۔',
          active: true,
          updatedBy: { id: 'staff-1', role: 'admin' },
          updatedAt: '2026-09-11T09:00:00Z',
        },
      ]);
    });

    it('maps an absent updated_by to undefined, not null, for a seeded default', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([scriptPayload({ updated_by: null })])));
      const { client } = buildClient();

      const result = await client.listWorkflowStageCallScripts();

      expect(result[0].updatedBy).toBeUndefined();
    });

    it('maps a blank announcement_ur to undefined, not null', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([scriptPayload({ announcement_ur: null })])));
      const { client } = buildClient();

      const result = await client.listWorkflowStageCallScripts();

      expect(result[0].announcementUr).toBeUndefined();
    });

    it('maps an empty list to an empty array', async () => {
      stubFetch(async () => jsonResponse(successEnvelope([])));
      const { client } = buildClient();

      expect(await client.listWorkflowStageCallScripts()).toEqual([]);
    });
  });

  describe('updateWorkflowStageCallScript', () => {
    it('sends the documented request body shape with no Idempotency-Key header', async () => {
      let capturedBody: string | undefined;
      let capturedHeaders: Record<string, string> | undefined;
      let capturedUrl: string | undefined;
      let capturedMethod: string | undefined;
      stubFetch(async (url, init) => {
        capturedUrl = String(url);
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        capturedHeaders = init?.headers as Record<string, string>;
        return jsonResponse(
          successEnvelope(scriptPayload({ announcement_en: 'Approved wording.', announcement_ur: 'منظور شدہ۔', active: true }))
        );
      });
      const { client } = buildClient();

      const result = await client.updateWorkflowStageCallScript('verified', {
        announcementEn: 'Approved wording.',
        announcementUr: 'منظور شدہ۔',
        active: true,
      });

      expect(capturedUrl).toBe('http://example.test/api/v1/admin/workflow_stage_call_scripts/verified');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedHeaders?.['Idempotency-Key']).toBeUndefined();
      expect(JSON.parse(capturedBody!)).toEqual({
        workflow_stage_call_script: { announcement_en: 'Approved wording.', announcement_ur: 'منظور شدہ۔', active: true },
      });
      expect(result.announcementEn).toBe('Approved wording.');
      expect(result.active).toBe(true);
    });

    it('URL-encodes the workflow_stage_code', async () => {
      let seenUrl = '';
      stubFetch(async (url) => {
        seenUrl = String(url);
        return jsonResponse(successEnvelope(scriptPayload()));
      });
      const { client } = buildClient();

      await client.updateWorkflowStageCallScript('verified', { announcementEn: 'x', announcementUr: '', active: true });

      expect(seenUrl).toBe('http://example.test/api/v1/admin/workflow_stage_call_scripts/verified');
    });

    async function rejectionForServerCode(code: string, status: number) {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code, message: 'server message', field: 'workflow_stage_call_script.announcement_en' }]), { status }));
      const { client } = buildClient();
      try {
        await client.updateWorkflowStageCallScript('verified', { announcementEn: '', announcementUr: '', active: true });
        throw new Error('expected rejection');
      } catch (error) {
        return error;
      }
    }

    it.each([
      ['validation_failed', 422, 'VALIDATION_FAILED'],
      ['not_found', 404, 'NOT_FOUND'],
      ['inactive_account', 403, 'INACTIVE_ACCOUNT'],
    ])('maps server code %s (%i) to %s', async (code, status, expectedCode) => {
      const error = await rejectionForServerCode(code as string, status as number);
      expect(error).toMatchObject({ code: expectedCode, message: 'server message' });
    });

    it('maps an ordinary 403 (no serverCode) to FORBIDDEN', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'forbidden', message: 'Not permitted.' }]), { status: 403 }));
      const { client } = buildClient();

      await expect(
        client.updateWorkflowStageCallScript('verified', { announcementEn: 'x', announcementUr: '', active: true })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('maps a 5xx to SERVER_ERROR', async () => {
      stubFetch(async () => jsonResponse(errorEnvelope([{ code: 'internal_server_error', message: 'Boom.' }]), { status: 500 }));
      const { client } = buildClient();

      await expect(
        client.updateWorkflowStageCallScript('verified', { announcementEn: 'x', announcementUr: '', active: true })
      ).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    });

    it('maps SESSION_EXPIRED from a StaffAuthError straight through', async () => {
      const apiClient = createApiClient({ baseUrl: 'http://example.test/api/v1' });
      const staffAuthClient: StaffAuthClient = {
        signIn: async () => {
          throw new Error('not used');
        },
        restoreSession: async () => null,
        signOut: async () => undefined,
        authenticatedRequest: async () => {
          throw new Error('not used');
        },
        authenticatedDataRequest: async () => {
          throw { code: 'SESSION_EXPIRED' };
        },
      };
      const client = createAdminWorkflowStageCallScriptsClient({ apiClient, staffAuthClient, getLocale: () => 'en' });

      await expect(
        client.updateWorkflowStageCallScript('verified', { announcementEn: 'x', announcementUr: '', active: true })
      ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    });
  });
});
