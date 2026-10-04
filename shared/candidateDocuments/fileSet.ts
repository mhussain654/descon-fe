// Multi-file document uploads (passport pages, CNIC/licence front and back,
// several certificates), shared by web and mobile. Everything here is driven
// by a requirement's backend-provided `uploadRules` -- never by a requirement
// code or a country -- and mirrors the backend's own file-set validation
// (descon-be Candidates::Documents::FileSetValidator) so problems show before
// upload. The backend stays authoritative and re-checks every file's actual
// content regardless.
import type { DocumentSideCode, DocumentUploadRules, DocumentFileSetReason } from './types';
import type { SelectedFileDescriptor } from './fileValidation';

/** Parts that must be uploaded together when either is used. */
export const SIDE_PAIRS: ReadonlyArray<readonly [DocumentSideCode, DocumentSideCode]> = [
  ['front', 'back'],
  ['page_1', 'page_2'],
];

/** Labels that may repeat within one document (several certificates). */
const REPEATABLE_SIDE_CODES = new Set<DocumentSideCode>(['certificate']);

/**
 * How the upload form for a requirement is shaped:
 * - `single`: one unlabelled file.
 * - `pair`: two labelled parts (front/back or page 1/page 2), or -- when
 *   `combinedAllowed` -- alternatively one combined PDF.
 * - `multiple`: one or more files sharing one label (or none), up to `maximumFiles`.
 */
export type FileSetLayout =
  | { kind: 'single' }
  | { kind: 'pair'; parts: readonly [DocumentSideCode, DocumentSideCode]; combinedAllowed: boolean }
  | { kind: 'multiple'; sideCode: DocumentSideCode | null; maximumFiles: number };

export function layoutFor(rules: DocumentUploadRules): FileSetLayout {
  const codes = rules.allowedSideCodes;
  const pair = SIDE_PAIRS.find(([first, second]) => codes.includes(first) && codes.includes(second));
  if (pair) {
    return { kind: 'pair', parts: pair, combinedAllowed: rules.combinedPdfAllowed && codes.includes('combined') };
  }
  const repeatable = codes.length === 1 && REPEATABLE_SIDE_CODES.has(codes[0]) ? codes[0] : null;
  if (repeatable || (codes.length === 0 && rules.maximumFiles > 1)) {
    return { kind: 'multiple', sideCode: repeatable, maximumFiles: rules.maximumFiles };
  }
  return { kind: 'single' };
}

/** One selected file and the part it represents (null when the requirement uses no labels). */
export interface FileSetEntry<TFile extends SelectedFileDescriptor = SelectedFileDescriptor> {
  sideCode: DocumentSideCode | null;
  file: TFile;
}

export type FileSetValidationError =
  | { kind: 'file'; index: number; code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_TYPE' }
  | { kind: 'set'; reason: DocumentFileSetReason };

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** The file's content type as reported, else inferred from its extension (some pickers report none). */
export function effectiveContentType(file: SelectedFileDescriptor): string | undefined {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  return EXTENSION_TYPES[extension];
}

function fileError(rules: DocumentUploadRules, file: SelectedFileDescriptor) {
  if (typeof file.size === 'number' && file.size <= 0) return 'EMPTY_FILE' as const;
  if (typeof file.size === 'number' && file.size > rules.maximumFileSize) return 'FILE_TOO_LARGE' as const;
  const type = effectiveContentType(file);
  if (!type || !(rules.acceptedContentTypes as string[]).includes(type)) return 'INVALID_TYPE' as const;
  return null;
}

function setError(rules: DocumentUploadRules, entries: FileSetEntry[]): DocumentFileSetReason | null {
  if (entries.length < rules.minimumFiles) return 'too_few_files';
  if (entries.length > rules.maximumFiles) return 'too_many_files';

  const codes = entries.map((entry) => entry.sideCode);
  if (rules.allowedSideCodes.length === 0) return codes.some(Boolean) ? 'side_code_not_allowed' : null;
  if (codes.some((code) => !code)) return 'side_code_required';
  if (codes.some((code) => !rules.allowedSideCodes.includes(code as DocumentSideCode))) return 'side_code_not_allowed';

  const seen = new Set<DocumentSideCode>();
  for (const code of codes as DocumentSideCode[]) {
    if (seen.has(code) && !REPEATABLE_SIDE_CODES.has(code)) return 'duplicate_side_code';
    seen.add(code);
  }

  const combinedIndex = codes.indexOf('combined');
  if (combinedIndex !== -1) {
    if (entries.length > 1) return 'combined_must_be_alone';
    if (!rules.combinedPdfAllowed || effectiveContentType(entries[combinedIndex].file) !== 'application/pdf') {
      return 'combined_requires_pdf';
    }
  }

  const incompletePair = SIDE_PAIRS.some(([first, second]) => seen.has(first) !== seen.has(second));
  return incompletePair ? 'incomplete_side_pair' : null;
}

/** The first problem with the selected file set (each file, then the set as a whole), or null. */
export function validateFileSet(rules: DocumentUploadRules, entries: FileSetEntry[]): FileSetValidationError | null {
  for (const [index, entry] of entries.entries()) {
    const code = fileError(rules, entry.file);
    if (code) return { kind: 'file', index, code };
  }
  const reason = setError(rules, entries);
  return reason ? { kind: 'set', reason } : null;
}

/** Translation key for a part label (e.g. "Front", "Page 1"). */
export const SIDE_CODE_LABEL_KEYS: Record<DocumentSideCode, string> = {
  combined: 'candidateDocumentsSideCombined',
  front: 'candidateDocumentsSideFront',
  back: 'candidateDocumentsSideBack',
  page_1: 'candidateDocumentsSidePage1',
  page_2: 'candidateDocumentsSidePage2',
  certificate: 'candidateDocumentsSideCertificate',
};

/** Translation key explaining a file-set problem, whether found here or reported by the backend. */
export const FILE_SET_REASON_KEYS: Record<DocumentFileSetReason, string> = {
  too_few_files: 'candidateDocumentsFileSetTooFewFiles',
  too_many_files: 'candidateDocumentsFileSetTooManyFiles',
  side_code_required: 'candidateDocumentsFileSetSideRequired',
  side_code_not_allowed: 'candidateDocumentsFileSetSideNotAllowed',
  duplicate_side_code: 'candidateDocumentsFileSetDuplicateSide',
  incomplete_side_pair: 'candidateDocumentsFileSetIncompletePair',
  combined_must_be_alone: 'candidateDocumentsFileSetCombinedAlone',
  combined_requires_pdf: 'candidateDocumentsFileSetCombinedPdf',
};

/** Whether taking a photo makes sense for this requirement -- only when it accepts images. */
export function acceptsImages(rules: DocumentUploadRules): boolean {
  return rules.acceptedContentTypes.some((type) => type.startsWith('image/'));
}

/** The files to send for the chosen pair mode: the combined PDF alone, or the selected parts in order. */
export function orderedEntries<TFile extends SelectedFileDescriptor>(
  layout: FileSetLayout,
  entries: FileSetEntry<TFile>[]
): FileSetEntry<TFile>[] {
  if (layout.kind !== 'pair') return entries;
  const order: DocumentSideCode[] = ['combined', ...layout.parts];
  return [...entries].sort((a, b) => order.indexOf(a.sideCode as DocumentSideCode) - order.indexOf(b.sideCode as DocumentSideCode));
}

/** How a pair document is being uploaded: one combined PDF, or its separate parts. */
export type PairUploadMode = 'combined' | 'parts';

/** Puts `file` in the slot for `sideCode` (replacing what was there), or empties the slot when `file` is null. */
export function replaceSlot<TFile extends SelectedFileDescriptor>(
  entries: FileSetEntry<TFile>[],
  sideCode: DocumentSideCode | null,
  file: TFile | null
): FileSetEntry<TFile>[] {
  const others = entries.filter((entry) => entry.sideCode !== sideCode);
  return file ? [...others, { sideCode, file }] : others;
}

/** Adds files under one label (repeatable documents), never past `maximumFiles`. */
export function appendEntries<TFile extends SelectedFileDescriptor>(
  entries: FileSetEntry<TFile>[],
  sideCode: DocumentSideCode | null,
  files: TFile[],
  maximumFiles: number
): FileSetEntry<TFile>[] {
  const room = Math.max(0, maximumFiles - entries.length);
  return [...entries, ...files.slice(0, room).map((file) => ({ sideCode, file }))];
}

/** The file in a given slot, if any. */
export function slotFile<TFile extends SelectedFileDescriptor>(
  entries: FileSetEntry<TFile>[],
  sideCode: DocumentSideCode | null
): TFile | null {
  return entries.find((entry) => entry.sideCode === sideCode)?.file ?? null;
}
