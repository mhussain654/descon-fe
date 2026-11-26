// Real UploadedDocumentsClient (see ./types.ts).
import type { ApiClient, ApiError } from '../api-client';
import type { StaffAuthClient, StaffAuthError } from '../auth/staffTypes';
import type { UploadedDocument, UploadedDocumentAccess, UploadedDocumentsClient, UploadedDocumentsError } from './types';

interface UploadedDocumentResponse {
  id: string;
  document_type: { code: string; name: string };
  status: string;
  submitted: boolean;
  uploaded_at: string | null;
  files: Array<{ id: string; side_code: string | null; original_filename: string; content_type: string; byte_size: number }>;
}

export interface RealUploadedDocumentsClientOptions {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => 'en' | 'ur';
}

function toUploadedDocument(data: UploadedDocumentResponse): UploadedDocument {
  return {
    id: data.id,
    documentType: data.document_type,
    status: data.status,
    submitted: data.submitted === true,
    uploadedAt: data.uploaded_at ?? null,
    files: (data.files ?? []).map((file) => ({
      id: file.id,
      sideCode: file.side_code ?? null,
      originalFilename: file.original_filename,
      contentType: file.content_type,
      byteSize: file.byte_size,
    })),
  };
}

function isStaffAuthError(error: unknown): error is StaffAuthError {
  return !!error && typeof error === 'object' && 'code' in error && !('status' in error);
}

function toError(error: unknown): UploadedDocumentsError {
  if (isStaffAuthError(error)) {
    if (error.code === 'SESSION_EXPIRED' || error.code === 'NETWORK_ERROR' || error.code === 'OFFLINE') return { code: error.code };
    return { code: 'UNKNOWN' };
  }
  const apiError = error as ApiError;
  if (!apiError || typeof apiError !== 'object' || !('code' in apiError)) return { code: 'UNKNOWN' };
  if (apiError.code === 'OFFLINE') return { code: 'OFFLINE' };
  if (apiError.code === 'NETWORK_ERROR' || apiError.code === 'TIMEOUT') return { code: 'NETWORK_ERROR' };
  if (apiError.status === 403) return { code: 'FORBIDDEN', message: apiError.message };
  if (apiError.status === 404) return { code: 'NOT_FOUND', message: apiError.message };
  if (typeof apiError.status === 'number' && apiError.status >= 500) return { code: 'SERVER_ERROR' };
  return { code: 'UNKNOWN', message: apiError.message };
}

export function createUploadedDocumentsClient(options: RealUploadedDocumentsClientOptions): UploadedDocumentsClient {
  const { apiClient, staffAuthClient, getLocale } = options;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Locale': getLocale() });
  const base = (candidateId: string) => `/admin/candidates/${encodeURIComponent(candidateId)}/uploaded_documents`;

  return {
    async listUploadedDocuments(candidateId) {
      try {
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.get<UploadedDocumentResponse[]>(base(candidateId), { headers: headers(token) })
        );
        return (data ?? []).map(toUploadedDocument);
      } catch (error) {
        throw toError(error);
      }
    },

    async openFile(candidateId, documentId, fileId) {
      try {
        const path = `${base(candidateId)}/${encodeURIComponent(documentId)}/access?file_id=${encodeURIComponent(fileId)}`;
        const data = await staffAuthClient.authenticatedDataRequest((token) =>
          apiClient.post<{ url: string; expires_at: string }>(path, undefined, { headers: headers(token) })
        );
        if (!data) throw { code: 'UNKNOWN' } satisfies UploadedDocumentsError;
        const access: UploadedDocumentAccess = { url: data.url, expiresAt: data.expires_at };
        return access;
      } catch (error) {
        throw toError(error);
      }
    },
  };
}
