import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { trainingVideosClient } from '../../../../lib/training-videos-client';
import { TrainingSettingPage } from './TrainingSettingPage';

vi.mock('../../../../lib/training-videos-client', () => ({ trainingVideosClient: {
  list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
} }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><LanguageProvider><TrainingSettingPage /></LanguageProvider></QueryClientProvider>);
}

const video = { id: 4, title_en: 'Airport preparation', title_ur: 'ہوائی اڈے کی تیاری', description_en: null, description_ur: null,
  position: 0, published: false, content_type: 'video/mp4', byte_size: 170_000_000, playback_url: 'https://example.test/signed' };

describe('Training videos admin page', () => {
  beforeEach(() => {
    vi.mocked(trainingVideosClient.list).mockReset().mockResolvedValue([video]);
    vi.mocked(trainingVideosClient.create).mockReset();
    vi.mocked(trainingVideosClient.update).mockReset().mockResolvedValue({ ...video, published: true });
    vi.mocked(trainingVideosClient.remove).mockReset();
  });

  it('lists a private draft and publishes it through the authenticated API client', async () => {
    renderPage();
    expect(await screen.findByText('Airport preparation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(trainingVideosClient.update).toHaveBeenCalledWith(4, { published: true }));
  });

  it('requires a local MP4 under 250 MiB before requesting an upload', async () => {
    renderPage();
    await screen.findByText('Airport preparation');
    fireEvent.change(screen.getByLabelText('English title'), { target: { value: 'Airport' } });
    fireEvent.change(screen.getByLabelText('Urdu title'), { target: { value: 'ہوائی اڈہ' } });
    fireEvent.change(screen.getByLabelText('MP4 video'), { target: { files: [new File(['bad'], 'bad.mov', { type: 'video/quicktime' })] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Upload video' }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose an MP4');
    expect(trainingVideosClient.create).not.toHaveBeenCalled();
  });
});
