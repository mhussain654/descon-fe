import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerBlobDownload } from './triggerBlobDownload';

describe('triggerBlobDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an object URL, clicks a download link with the given filename, then revokes the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    triggerBlobDownload(new Blob(['csv-bytes']), 'status_summary.csv');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
