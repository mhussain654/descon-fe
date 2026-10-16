import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './api-client';
import { staffAuthClient } from './staff-auth-client';
import { trainingVideosClient } from './training-videos-client';

vi.mock('./api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } }));
vi.mock('./staff-auth-client', () => ({ staffAuthClient: { authenticatedDataRequest: vi.fn() } }));

class FakeUpload {
  status = 200;
  upload = { onprogress: (_event: ProgressEvent) => {} };
  onload = () => {};
  onerror = () => {};
  headers: Record<string, string> = {};
  open(method: string, url: string) { expect(method).toBe('PUT'); expect(url).toBe('https://s3.test/private'); }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(body: File) {
    expect(body.size).toBe(6);
    expect(this.headers['Content-MD5']).toBe('Xo/5v1W6NQgZnSLphBKb5g==');
    this.upload.onprogress({ lengthComputable: true, loaded: 6, total: 6 } as ProgressEvent);
    this.onload();
  }
}

describe('staff training direct upload', () => {
  beforeEach(() => {
    vi.mocked(staffAuthClient.authenticatedDataRequest).mockImplementation(async callback => callback('staff-token'));
    vi.stubGlobal('XMLHttpRequest', FakeUpload);
    vi.mocked(apiClient.post).mockReset();
  });

  it('hashes the file, requests a bounded ticket, PUTs to S3, then registers the signed blob', async () => {
    const file = new File(['sample'], 'airport.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'slice', { value: () => ({ arrayBuffer: async () => new TextEncoder().encode('sample').buffer }) });
    const ticket = { signed_id: 'signed-id', upload_url: 'https://s3.test/private', upload_headers: { 'Content-MD5': 'Xo/5v1W6NQgZnSLphBKb5g==' } };
    const video = { id: 1 };
    vi.mocked(apiClient.post).mockResolvedValueOnce(ticket).mockResolvedValueOnce(video);
    const progress = vi.fn();
    await expect(trainingVideosClient.create({ title_en: 'Airport', title_ur: 'ہوائی اڈہ', position: 0, published: false }, file, progress)).resolves.toEqual(video);
    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/admin/training_videos/upload', {
      training_video_upload: { filename: 'airport.mp4', byte_size: 6, content_type: 'video/mp4', checksum: 'Xo/5v1W6NQgZnSLphBKb5g==' },
    }, { headers: { Authorization: 'Bearer staff-token' } });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/admin/training_videos', {
      training_video: { title_en: 'Airport', title_ur: 'ہوائی اڈہ', position: 0, published: false, file: 'signed-id' },
    }, { headers: { Authorization: 'Bearer staff-token' } });
    expect(progress).toHaveBeenCalledWith(100);
  });
});
