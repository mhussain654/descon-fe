// A candidate's uploaded documents, submitted or not -- view only, for
// support checks. Wired to descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/uploaded_documents
//   POST /api/v1/admin/candidates/{candidate_id}/uploaded_documents/{id}/access
// Developer-only (`view_uploaded_documents`). Web-only.

export interface UploadedDocumentFile {
  id: string;
  sideCode: string | null;
  originalFilename: string;
  contentType: string;
  byteSize: number;
}

export interface UploadedDocument {
  id: string;
  documentType: { code: string; name: string };
  /** Backend status code: uploaded, under_verification, verified or rejected. */
  status: string;
  /** Whether the candidate has submitted it for review. */
  submitted: boolean;
  uploadedAt: string | null;
  files: UploadedDocumentFile[];
}

export interface UploadedDocumentAccess {
  /** Short-lived, signed, relative path -- resolve against the API origin. */
  url: string;
  expiresAt: string;
}

export type UploadedDocumentsErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'SESSION_EXPIRED' | 'NETWORK_ERROR' | 'OFFLINE' | 'SERVER_ERROR' | 'UNKNOWN';

export interface UploadedDocumentsError {
  code: UploadedDocumentsErrorCode;
  message?: string;
}

export interface UploadedDocumentsClient {
  listUploadedDocuments(candidateId: string): Promise<UploadedDocument[]>;
  openFile(candidateId: string, documentId: string, fileId: string): Promise<UploadedDocumentAccess>;
}
