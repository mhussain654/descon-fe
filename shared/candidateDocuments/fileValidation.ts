// Client-side file validation for the candidate document upload flow. This
// is a UX improvement only -- the backend remains authoritative and
// validates actual file content regardless of what this module decides
// (ticket: "Frontend validation is for user experience only.").
//
// Platform-independent: works off a plain descriptor, never a browser File
// or a React Native picker result directly, so both web and mobile feature
// code can reduce their own file representation down to this shape first.

/** Mirrors the backend's documented limit (openapi.yaml / descon-be's UploadService): 5 MiB. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type FileValidationError = 'FILE_REQUIRED' | 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_TYPE';

export interface SelectedFileDescriptor {
  name: string;
  /** Undefined when the platform/picker doesn't report a size upfront -- size is only checked when known. */
  size: number | undefined;
  /** Undefined/blank when the platform/picker doesn't reliably report a MIME type -- the extension is checked as a fallback in that case. */
  type: string | undefined;
}

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.pdf') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
}

/** Returns the first validation problem with `file`, or `null` if it passes every client-side check. */
export function validateSelectedFile(file: SelectedFileDescriptor | null): FileValidationError | null {
  if (!file) return 'FILE_REQUIRED';

  if (typeof file.size === 'number' && file.size <= 0) return 'EMPTY_FILE';
  if (typeof file.size === 'number' && file.size > MAX_FILE_BYTES) return 'FILE_TOO_LARGE';

  const hasAllowedType = !!file.type && (ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type);
  if (!hasAllowedType && !hasAllowedExtension(file.name)) return 'INVALID_TYPE';

  return null;
}
