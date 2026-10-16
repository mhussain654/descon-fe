import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import TrainingRoute from './training';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTrainingVideos } from '../features/candidate/training/hooks/useTrainingVideos';
import { useLanguage } from '../contexts/LanguageContext';

jest.mock('../features/auth/RequireAuth', () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../features/candidate/training/hooks/useTrainingVideos', () => ({ useTrainingVideos: jest.fn() }));
jest.mock('../contexts/LanguageContext', () => ({ useLanguage: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: () => ({ loop: false, addListener: () => ({ remove: () => undefined }) }),
}));

const video = { id: 1, title_en: 'At the airport', title_ur: 'ہوائی اڈے پر', description_en: 'Boarding steps',
  description_ur: 'سفر کے مراحل', position: 0, published: true, content_type: 'video/mp4', byte_size: 170_000_000,
  playback_url: 'https://example.test/signed' };
const translations: Record<string, string> = { homeQuickTrainingTitle: 'Training', trainingIntro: 'Watch short videos',
  trainingBack: 'Back', trainingAllVideos: 'All videos', trainingEmpty: 'No training videos', trainingLoadError: 'Failed', retry: 'Retry' };

describe('candidate training screen', () => {
  beforeEach(() => {
    jest.mocked(useLanguage).mockReturnValue({ language: 'en', t: (key: string) => translations[key] ?? key } as ReturnType<typeof useLanguage>);
  });

  it('shows the empty and retry states instead of an inactive tile', () => {
    jest.mocked(useTrainingVideos).mockReturnValue({ data: [], isPending: false, isError: false, isRefetching: false,
      refetch: jest.fn() } as unknown as ReturnType<typeof useTrainingVideos>);
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, bottom: 24, left: 0, right: 0 } }}><TrainingRoute /></SafeAreaProvider>);
    expect(screen.getByText('No training videos')).toBeOnTheScreen();
  });

  it('refreshes the signed URL before opening a published Urdu video', async () => {
    jest.mocked(useLanguage).mockReturnValue({ language: 'ur', t: (key: string) => translations[key] ?? key } as ReturnType<typeof useLanguage>);
    jest.mocked(useTrainingVideos).mockReturnValue({ data: [video], isPending: false, isError: false, isRefetching: false,
      refetch: jest.fn().mockResolvedValue({ data: [video] }) } as unknown as ReturnType<typeof useTrainingVideos>);
    render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, bottom: 24, left: 0, right: 0 } }}><TrainingRoute /></SafeAreaProvider>);
    fireEvent.press(screen.getByRole('button', { name: 'ہوائی اڈے پر' }));
    await waitFor(() => expect(screen.getByText('All videos')).toBeOnTheScreen());
  });
});
