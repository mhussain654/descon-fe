import { describeFileType, isPreviewableImageType } from './fileDescription';

describe('describeFileType', () => {
  it('labels a PDF by its MIME type', () => {
    expect(describeFileType({ name: 'passport.pdf', size: 1024, type: 'application/pdf' })).toBe('PDF');
  });

  it('labels a JPEG by its MIME type', () => {
    expect(describeFileType({ name: 'photo.jpg', size: 1024, type: 'image/jpeg' })).toBe('JPEG');
  });

  it('labels a PNG by its MIME type', () => {
    expect(describeFileType({ name: 'scan.png', size: 1024, type: 'image/png' })).toBe('PNG');
  });

  it('falls back to the extension when the platform reports no MIME type', () => {
    expect(describeFileType({ name: 'passport.pdf', size: 1024, type: undefined })).toBe('PDF');
  });

  it('never renders the raw MIME string for an unrecognized type', () => {
    expect(describeFileType({ name: 'photo.heic', size: 1024, type: 'image/heic' })).toBe('HEIC');
  });

  it('falls back to the whole name, uppercased, when it has no extension and no recognized type', () => {
    expect(describeFileType({ name: 'noextension', size: 1024, type: undefined })).toBe('NOEXTENSION');
  });
});

describe('isPreviewableImageType', () => {
  it('is previewable for a JPEG', () => {
    expect(isPreviewableImageType({ name: 'photo.jpg', size: 1024, type: 'image/jpeg' })).toBe(true);
  });

  it('is previewable for a PNG', () => {
    expect(isPreviewableImageType({ name: 'scan.png', size: 1024, type: 'image/png' })).toBe(true);
  });

  it('is not previewable for a PDF', () => {
    expect(isPreviewableImageType({ name: 'passport.pdf', size: 1024, type: 'application/pdf' })).toBe(false);
  });

  it('is not previewable when the type is unknown', () => {
    expect(isPreviewableImageType({ name: 'file', size: 1024, type: undefined })).toBe(false);
  });
});
