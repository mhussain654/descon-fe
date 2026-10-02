jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { buildFormData, type PickedDocument, type PickedFile } from './useDocumentUpload';

function picked(asset: PickedDocument): PickedFile {
  return { name: asset.name, size: asset.size, type: asset.mimeType, asset };
}

const cvAsset: PickedDocument = { uri: 'file:///tmp/cv.pdf', name: 'cv.pdf', size: 1024, mimeType: 'application/pdf', lastModified: 1 };

describe('buildFormData', () => {
  let appendSpy: jest.SpyInstance;

  beforeEach(() => {
    appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
  });

  afterEach(() => appendSpy.mockRestore());

  it('appends each picked file as a files[] uri/name/type part (native), with no label for an unlabelled document', () => {
    buildFormData('cv', [{ sideCode: null, file: picked(cvAsset) }], '');

    expect(appendSpy).toHaveBeenCalledWith('candidate_document[requirement_code]', 'cv');
    expect(appendSpy).toHaveBeenCalledWith('candidate_document[files][][file]', {
      uri: 'file:///tmp/cv.pdf',
      name: 'cv.pdf',
      type: 'application/pdf',
    });
    expect(appendSpy).not.toHaveBeenCalledWith('candidate_document[files][][side_code]', expect.anything());
  });

  it('sends every part of a multi-file document with its label, in order', () => {
    const front = { uri: 'file:///tmp/front.jpg', name: 'front.jpg', mimeType: 'image/jpeg', lastModified: 1 };
    const back = { uri: 'file:///tmp/back.jpg', name: 'back.jpg', mimeType: 'image/jpeg', lastModified: 2 };

    buildFormData(
      'cnic',
      [
        { sideCode: 'front', file: picked(front) },
        { sideCode: 'back', file: picked(back) },
      ],
      ''
    );

    const fileParts = appendSpy.mock.calls.filter(([key]) => key === 'candidate_document[files][][file]');
    const labels = appendSpy.mock.calls.filter(([key]) => key === 'candidate_document[files][][side_code]');
    expect(fileParts.map(([, part]) => part.name)).toEqual(['front.jpg', 'back.jpg']);
    expect(labels.map(([, label]) => label)).toEqual(['front', 'back']);
  });

  it('appends the real File object directly when one is present (Expo web)', () => {
    const webFile = { name: 'cv.pdf' } as unknown as File;

    buildFormData('cv', [{ sideCode: null, file: picked({ ...cvAsset, uri: 'blob:whatever', file: webFile }) }], '');

    expect(appendSpy).toHaveBeenCalledWith('candidate_document[files][][file]', webFile, 'cv.pdf');
  });

  it('only appends issued_on for the police_character requirement', () => {
    buildFormData('cv', [{ sideCode: null, file: picked(cvAsset) }], '2026-01-01');
    expect(appendSpy).not.toHaveBeenCalledWith('candidate_document[issued_on]', expect.anything());

    appendSpy.mockClear();

    buildFormData('police_character', [{ sideCode: null, file: picked(cvAsset) }], '2026-01-01');
    expect(appendSpy).toHaveBeenCalledWith('candidate_document[issued_on]', '2026-01-01');
  });
});
