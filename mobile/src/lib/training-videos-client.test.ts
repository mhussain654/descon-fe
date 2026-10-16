import { apiClient } from './api-client';
import { getTrainingVideos } from './training-videos-client';

jest.mock('./api-client', () => ({ apiClient: { get: jest.fn() } }));

const video = { id: 1, title_en: 'Airport', title_ur: 'ہوائی اڈہ', description_en: null, description_ur: null,
  position: 0, published: true, content_type: 'video/mp4', byte_size: 170_000_000, playback_url: 'https://example.test/signed' };

describe('candidate training video API', () => {
  it('uses the authenticated candidate endpoint and locale, preserving the private playback URL', async () => {
    jest.mocked(apiClient.get).mockResolvedValueOnce([video]);
    await expect(getTrainingVideos('candidate-token', 'ur')).resolves.toEqual([video]);
    expect(apiClient.get).toHaveBeenCalledWith('/candidate/training_videos', {
      headers: { Authorization: 'Bearer candidate-token', 'X-Locale': 'ur' },
    });
  });

  it('treats an empty API envelope as an error rather than an empty library', async () => {
    jest.mocked(apiClient.get).mockResolvedValueOnce(undefined);
    await expect(getTrainingVideos('candidate-token', 'en')).rejects.toThrow('Empty training video response');
  });
});
