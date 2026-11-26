import { createApiClient } from '../api-client';
import type { StaffAuthClient } from '../auth/staffTypes';
import { createUploadedDocumentsClient } from './realUploadedDocumentsClient';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respondWith(status: number, body: unknown, seen: Array<{ url: string; method?: string }> = []) {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(url), method: init?.method });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return seen;
}

const envelope = (data: unknown) => ({ data, meta: { request_id: 'req-1', timestamp: '2026-11-26T09:00:00Z' }, errors: [] });

const staffAuthClient = {
  authenticatedDataRequest: async (makeRequest: (token: string) => Promise<unknown>) => makeRequest('staff-access-token'),
} as unknown as StaffAuthClient;

const client = () =>
  createUploadedDocumentsClient({ apiClient: createApiClient({ baseUrl: 'http://example.test/api/v1' }), staffAuthClient, getLocale: () => 'en' });

describe('uploaded documents client', () => {
  it('lists the documents with their files and submitted flag', async () => {
    const seen = respondWith(200, envelope([{
      id: 'doc-1', document_type: { code: 'passport', name: 'Passport' }, status: 'uploaded', submitted: false,
      uploaded_at: '2026-11-26T09:00:00Z',
      files: [{ id: 'file-1', side_code: 'page_1', original_filename: 'p1.jpg', content_type: 'image/jpeg', byte_size: 1200 }],
    }]));

    const documents = await client().listUploadedDocuments('cand-1');

    expect(seen[0].url).toBe('http://example.test/api/v1/admin/candidates/cand-1/uploaded_documents');
    expect(documents).toEqual([{
      id: 'doc-1', documentType: { code: 'passport', name: 'Passport' }, status: 'uploaded', submitted: false,
      uploadedAt: '2026-11-26T09:00:00Z',
      files: [{ id: 'file-1', sideCode: 'page_1', originalFilename: 'p1.jpg', contentType: 'image/jpeg', byteSize: 1200 }],
    }]);
  });

  it('asks for a short-lived link to one file', async () => {
    const seen = respondWith(200, envelope({ url: '/rails/active_storage/x', expires_at: '2026-11-26T09:05:00Z' }));

    const access = await client().openFile('cand-1', 'doc-1', 'file-1');

    expect(seen[0]).toEqual({ url: 'http://example.test/api/v1/admin/candidates/cand-1/uploaded_documents/doc-1/access?file_id=file-1', method: 'POST' });
    expect(access).toEqual({ url: '/rails/active_storage/x', expiresAt: '2026-11-26T09:05:00Z' });
  });

  it('maps a 403 to FORBIDDEN', async () => {
    respondWith(403, { errors: [{ code: 'document_access_forbidden', message: 'Not allowed.' }] });

    await expect(client().listUploadedDocuments('cand-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
