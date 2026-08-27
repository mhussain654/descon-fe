import { MAX_FILE_BYTES, validateSelectedFile } from './fileValidation';

describe('validateSelectedFile', () => {
  it('requires a file', () => {
    expect(validateSelectedFile(null)).toBe('FILE_REQUIRED');
  });

  it('accepts a well-formed PDF', () => {
    expect(validateSelectedFile({ name: 'passport.pdf', size: 1024, type: 'application/pdf' })).toBeNull();
  });

  it('accepts a well-formed JPEG', () => {
    expect(validateSelectedFile({ name: 'photo.jpg', size: 1024, type: 'image/jpeg' })).toBeNull();
  });

  it('accepts a well-formed PNG', () => {
    expect(validateSelectedFile({ name: 'scan.png', size: 1024, type: 'image/png' })).toBeNull();
  });

  it('rejects an empty file when size is known', () => {
    expect(validateSelectedFile({ name: 'empty.pdf', size: 0, type: 'application/pdf' })).toBe('EMPTY_FILE');
  });

  it('rejects a file larger than the 5 MiB limit', () => {
    expect(validateSelectedFile({ name: 'big.pdf', size: MAX_FILE_BYTES + 1, type: 'application/pdf' })).toBe(
      'FILE_TOO_LARGE'
    );
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateSelectedFile({ name: 'exact.pdf', size: MAX_FILE_BYTES, type: 'application/pdf' })).toBeNull();
  });

  it('rejects an unsupported type even with a plausible extension mismatch', () => {
    expect(validateSelectedFile({ name: 'resume.docx', size: 1024, type: 'application/msword' })).toBe('INVALID_TYPE');
  });

  it('falls back to the extension when the platform reports no MIME type', () => {
    expect(validateSelectedFile({ name: 'passport.pdf', size: 1024, type: undefined })).toBeNull();
  });

  it('does not size-check when the platform does not report a size', () => {
    expect(validateSelectedFile({ name: 'passport.pdf', size: undefined, type: 'application/pdf' })).toBeNull();
  });
});
