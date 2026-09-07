jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { buildFormData } from './useDocumentUpload';

describe('buildFormData', () => {
  it('appends the picker-supplied uri/name/type shape when no web File is present (native)', () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);

    buildFormData(
      'cv',
      { uri: 'file:///tmp/cv.pdf', name: 'cv.pdf', size: 1024, mimeType: 'application/pdf', lastModified: 1 },
      ''
    );

    expect(appendSpy).toHaveBeenCalledWith('candidate_document[requirement_code]', 'cv');
    expect(appendSpy).toHaveBeenCalledWith('candidate_document[file]', {
      uri: 'file:///tmp/cv.pdf',
      name: 'cv.pdf',
      type: 'application/pdf',
    });

    appendSpy.mockRestore();
  });

  it('appends the real File object directly when one is present (Expo web)', () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    const webFile = { name: 'cv.pdf' } as unknown as File;

    buildFormData(
      'cv',
      { uri: 'blob:whatever', name: 'cv.pdf', size: 1024, mimeType: 'application/pdf', lastModified: 1, file: webFile },
      ''
    );

    expect(appendSpy).toHaveBeenCalledWith('candidate_document[file]', webFile, 'cv.pdf');

    appendSpy.mockRestore();
  });

  it('only appends issued_on for the police_character requirement', () => {
    const appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);

    buildFormData('cv', { uri: 'file:///tmp/cv.pdf', name: 'cv.pdf', lastModified: 1 }, '2026-01-01');
    expect(appendSpy).not.toHaveBeenCalledWith('candidate_document[issued_on]', expect.anything());

    appendSpy.mockClear();

    buildFormData('police_character', { uri: 'file:///tmp/pcc.pdf', name: 'pcc.pdf', lastModified: 1 }, '2026-01-01');
    expect(appendSpy).toHaveBeenCalledWith('candidate_document[issued_on]', '2026-01-01');

    appendSpy.mockRestore();
  });
});
