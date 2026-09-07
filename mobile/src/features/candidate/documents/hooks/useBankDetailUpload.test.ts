jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { buildFormData } from './useBankDetailUpload';

describe('buildFormData', () => {
  function appendSpy() {
    return jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
  }

  it('appends the picker-supplied uri/name/type shape when no web File is present (native)', () => {
    const spy = appendSpy();

    buildFormData('Ahmed Ali', 'PK24SCBL0000001123456702', 'Sample Bank', {
      uri: 'file:///tmp/cheque.pdf',
      name: 'cheque.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      lastModified: 1,
    });

    expect(spy).toHaveBeenCalledWith('bank_detail[account_title]', 'Ahmed Ali');
    expect(spy).toHaveBeenCalledWith('bank_detail[account_number]', 'PK24SCBL0000001123456702');
    expect(spy).toHaveBeenCalledWith('bank_detail[bank_name]', 'Sample Bank');
    expect(spy).toHaveBeenCalledWith('bank_detail[proof]', {
      uri: 'file:///tmp/cheque.pdf',
      name: 'cheque.pdf',
      type: 'application/pdf',
    });

    spy.mockRestore();
  });

  it('appends the real File object directly when one is present (Expo web)', () => {
    const spy = appendSpy();
    const webFile = { name: 'cheque.pdf' } as unknown as File;

    buildFormData('Ahmed Ali', 'PK24SCBL0000001123456702', 'Sample Bank', {
      uri: 'blob:whatever',
      name: 'cheque.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      lastModified: 1,
      file: webFile,
    });

    expect(spy).toHaveBeenCalledWith('bank_detail[proof]', webFile, 'cheque.pdf');

    spy.mockRestore();
  });
});
