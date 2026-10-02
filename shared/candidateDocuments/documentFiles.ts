// Maps the backend's `files` array of a (possibly multi-file) document --
// shared by the candidate and staff document clients, which both receive it.
import type { CandidateDocumentContentType, CandidateDocumentFile, DocumentSideCode } from './types';

interface CandidateDocumentFileResponse {
  id: string;
  side_code: string | null;
  position: number;
  file_name: string;
  content_type: string;
  file_size: number;
}

const KNOWN_SIDE_CODES = new Set<string>(['combined', 'front', 'back', 'page_1', 'page_2', 'certificate']);
const KNOWN_CONTENT_TYPES = new Set<string>(['application/pdf', 'image/jpeg', 'image/png']);

/** An unknown (future) label maps to null rather than leaking a raw code into the UI. */
export function toSideCode(raw: unknown): DocumentSideCode | null {
  return typeof raw === 'string' && KNOWN_SIDE_CODES.has(raw) ? (raw as DocumentSideCode) : null;
}

function toFiniteNumber(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
}

function toDocumentFile(raw: unknown): CandidateDocumentFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CandidateDocumentFileResponse>;
  if (typeof value.id !== 'string' || !value.id) return null;

  return {
    id: value.id,
    sideCode: toSideCode(value.side_code),
    position: toFiniteNumber(value.position, 0),
    fileName: typeof value.file_name === 'string' ? value.file_name : '',
    // A malformed type only affects which preview is attempted, never what renders around it.
    contentType:
      typeof value.content_type === 'string' && KNOWN_CONTENT_TYPES.has(value.content_type)
        ? (value.content_type as CandidateDocumentContentType)
        : 'application/pdf',
    fileSize: toFiniteNumber(value.file_size, 0),
  };
}

/** Valid files in position order; malformed entries are dropped rather than crashing the list. */
export function toDocumentFiles(raw: unknown): CandidateDocumentFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(toDocumentFile)
    .filter((file): file is CandidateDocumentFile => file !== null)
    .sort((a, b) => a.position - b.position);
}
