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
  it('plays a video on the page with a freshly signed link', async () => {
    vi.mocked(trainingVideosClient.list)
      .mockReset()
      .mockResolvedValueOnce([video])
      .mockResolvedValue([{ ...video, playback_url: 'https://example.test/fresh-link' }]);
    const { container } = renderPage();
    await screen.findByText('Airport preparation');
    expect(container.querySelector('video')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://example.test/fresh-link');
    expect(screen.queryByRole('link', { name: /preview/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close player' }));
    expect(container.querySelector('video')).toBeNull();
  });

  it('tells the admin when the browser cannot play the video', async () => {
    const { container } = renderPage();
    await screen.findByText('Airport preparation');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());

    fireEvent.error(container.querySelector('video')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be played');
  });

  it('searches and sorts the video list', async () => {
    const second = { ...video, id: 5, title_en: 'Accommodation rules', title_ur: 'رہائش', position: 1 };
    vi.mocked(trainingVideosClient.list).mockResolvedValue([video, second]);
    renderPage();
    await screen.findByText('Airport preparation');
    const titles = () => screen.getAllByRole('heading', { level: 2 }).map(node => node.textContent).filter(text => /Airport|Accommodation/.test(text ?? ''));
    expect(titles()).toEqual(['Airport preparation', 'Accommodation rules']);

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'title' } });
    expect(titles()).toEqual(['Accommodation rules', 'Airport preparation']);

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'newest' } });
    expect(titles()).toEqual(['Accommodation rules', 'Airport preparation']);

    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'airport' } });
    expect(titles()).toEqual(['Airport preparation']);

    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'zzz' } });
    expect(screen.getByText('No videos match your search.')).toBeInTheDocument();
  });
});
