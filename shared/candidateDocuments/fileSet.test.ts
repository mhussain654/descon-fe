// Runs under both web's Vitest and mobile's Jest (globals in both).
import { acceptsImages, layoutFor, orderedEntries, validateFileSet, type FileSetEntry } from './fileSet';
import type { DocumentUploadRules } from './types';

const ALL_TYPES: DocumentUploadRules['acceptedContentTypes'] = ['application/pdf', 'image/jpeg', 'image/png'];

const RULES: Record<string, DocumentUploadRules> = {
  passport: {
    minimumFiles: 1, maximumFiles: 2, combinedPdfAllowed: true, allowedSideCodes: ['combined', 'page_1', 'page_2'],
    acceptedContentTypes: ALL_TYPES, maximumFileSize: 5_000_000,
  },
  cnic: {
    minimumFiles: 1, maximumFiles: 2, combinedPdfAllowed: true, allowedSideCodes: ['combined', 'front', 'back'],
    acceptedContentTypes: ALL_TYPES, maximumFileSize: 5_000_000,
  },
  certificates: {
    minimumFiles: 1, maximumFiles: 10, combinedPdfAllowed: false, allowedSideCodes: ['certificate'],
    acceptedContentTypes: ALL_TYPES, maximumFileSize: 5_000_000,
  },
  cv: {
    minimumFiles: 1, maximumFiles: 1, combinedPdfAllowed: false, allowedSideCodes: [],
    acceptedContentTypes: ALL_TYPES, maximumFileSize: 5_000_000,
  },
  photo: {
    minimumFiles: 1, maximumFiles: 1, combinedPdfAllowed: false, allowedSideCodes: [],
    acceptedContentTypes: ['image/jpeg', 'image/png'], maximumFileSize: 5_000_000,
  },
};

const pdf = (name = 'doc.pdf', size = 1000) => ({ name, size, type: 'application/pdf' });
const jpg = (name = 'photo.jpg', size = 1000) => ({ name, size, type: 'image/jpeg' });
const entry = (sideCode: FileSetEntry['sideCode'], file = jpg()): FileSetEntry => ({ sideCode, file });

describe('layoutFor', () => {
  it('derives the upload form from the backend rules alone', () => {
    expect(layoutFor(RULES.passport)).toEqual({ kind: 'pair', parts: ['page_1', 'page_2'], combinedAllowed: true });
    expect(layoutFor(RULES.cnic)).toEqual({ kind: 'pair', parts: ['front', 'back'], combinedAllowed: true });
    expect(layoutFor(RULES.certificates)).toEqual({ kind: 'multiple', sideCode: 'certificate', maximumFiles: 10 });
    expect(layoutFor(RULES.cv)).toEqual({ kind: 'single' });
    expect(layoutFor({ ...RULES.cv, maximumFiles: 3 })).toEqual({ kind: 'multiple', sideCode: null, maximumFiles: 3 });
  });

  it('only offers a combined PDF when the rules allow it', () => {
    expect(layoutFor({ ...RULES.cnic, combinedPdfAllowed: false, allowedSideCodes: ['front', 'back'] })).toMatchObject({
      combinedAllowed: false,
    });
  });
});

describe('validateFileSet', () => {
  it('accepts one combined PDF or both labelled pages for a passport', () => {
    expect(validateFileSet(RULES.passport, [entry('combined', pdf())])).toBeNull();
    expect(validateFileSet(RULES.passport, [entry('page_1'), entry('page_2')])).toBeNull();
  });

  it('requires both CNIC sides when photos are used', () => {
    expect(validateFileSet(RULES.cnic, [entry('front')])).toEqual({ kind: 'set', reason: 'incomplete_side_pair' });
    expect(validateFileSet(RULES.cnic, [entry('front'), entry('back')])).toBeNull();
  });

  it('rejects a combined upload that is an image, or that has other files with it', () => {
    expect(validateFileSet(RULES.cnic, [entry('combined')])).toEqual({ kind: 'set', reason: 'combined_requires_pdf' });
    expect(validateFileSet(RULES.cnic, [entry('combined', pdf()), entry('front')])).toEqual({
      kind: 'set',
      reason: 'combined_must_be_alone',
    });
  });

  it('rejects missing, unknown and duplicate labels', () => {
    expect(validateFileSet(RULES.cnic, [entry(null), entry('back')])).toEqual({ kind: 'set', reason: 'side_code_required' });
    expect(validateFileSet(RULES.cnic, [entry('page_1'), entry('page_2')])).toEqual({
      kind: 'set',
      reason: 'side_code_not_allowed',
    });
    expect(validateFileSet(RULES.cnic, [entry('front'), entry('front')])).toEqual({
      kind: 'set',
      reason: 'duplicate_side_code',
    });
    expect(validateFileSet(RULES.cv, [entry('front', pdf())])).toEqual({ kind: 'set', reason: 'side_code_not_allowed' });
  });

  it('enforces the file count and lets certificates repeat', () => {
    expect(validateFileSet(RULES.cnic, [])).toEqual({ kind: 'set', reason: 'too_few_files' });
    expect(validateFileSet(RULES.cv, [entry(null, pdf()), entry(null, pdf())])).toEqual({ kind: 'set', reason: 'too_many_files' });
    expect(validateFileSet(RULES.certificates, [entry('certificate', pdf()), entry('certificate')])).toBeNull();
  });

  it('checks each file against the requirement type and size, reporting which file', () => {
    expect(validateFileSet(RULES.photo, [entry(null, pdf())])).toEqual({ kind: 'file', index: 0, code: 'INVALID_TYPE' });
    expect(validateFileSet(RULES.cnic, [entry('front'), entry('back', jpg('big.jpg', 6_000_000))])).toEqual({
      kind: 'file',
      index: 1,
      code: 'FILE_TOO_LARGE',
    });
    expect(validateFileSet(RULES.cv, [entry(null, pdf('empty.pdf', 0))])).toEqual({ kind: 'file', index: 0, code: 'EMPTY_FILE' });
  });

  it('infers the type from the extension when the picker reports none', () => {
    expect(validateFileSet(RULES.cv, [entry(null, { name: 'cv.PDF', size: 10, type: undefined })])).toBeNull();
    expect(validateFileSet(RULES.cv, [entry(null, { name: 'cv.docx', size: 10, type: undefined })])).toMatchObject({
      code: 'INVALID_TYPE',
    });
  });
});

describe('helpers', () => {
  it('offers photo capture only when the requirement accepts images', () => {
    expect(acceptsImages(RULES.photo)).toBe(true);
    expect(acceptsImages({ ...RULES.cv, acceptedContentTypes: ['application/pdf'] })).toBe(false);
  });

  it('sends pair parts in their natural order', () => {
    const layout = layoutFor(RULES.cnic);
    const sorted = orderedEntries(layout, [entry('back'), entry('front')]);
    expect(sorted.map((item) => item.sideCode)).toEqual(['front', 'back']);
  });
});
