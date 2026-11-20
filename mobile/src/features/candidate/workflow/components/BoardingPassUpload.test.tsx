import { QueryClientProvider } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { CandidateFlightDetail } from '../../../../../../shared/candidateFlightDetail/types';
import { translations, type TranslationKey } from '../../../../../../shared/i18n/translations';
import { createQueryClientTestLifecycle } from '../../../../testSupport/queryClientTestLifecycle';
import { BoardingPassUpload } from './BoardingPassUpload';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { accessToken: 'candidate-token', candidateId: 'candidate-1' },
    status: 'authenticated',
    getAccessToken: () => Promise.resolve('candidate-token'),
  }),
}));

jest.mock('../../../../lib/candidate-flight-detail-client', () => ({
  candidateFlightDetailClient: { uploadBoardingPass: jest.fn(), requestBoardingPassAccess: jest.fn() },
}));

const t = (key: TranslationKey) => translations.en[key];
const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

function flight(overrides: Partial<CandidateFlightDetail> = {}): CandidateFlightDetail {
  return {
    id: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
    airline: 'Qatar Airways',
    flightNumber: 'QR-123',
    sector: 'LHE-DOH',
    flightDepartureAt: '2026-09-20T14:30:00Z',
    ticketAttached: true,
    mobilizedOn: null,
    mobilized: false,
    boardingPassUploadedAt: null,
    ...overrides,
  };
}

function pickedAsset(overrides: Partial<ImagePicker.ImagePickerAsset> = {}): ImagePicker.ImagePickerAsset {
  return { uri: 'file:///pass.jpg', width: 800, height: 600, mimeType: 'image/jpeg', fileSize: 300_000, fileName: 'pass.jpg', ...overrides } as ImagePicker.ImagePickerAsset;
}

function renderUpload(detail: CandidateFlightDetail = flight()) {
  return trackRender(
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <BoardingPassUpload flight={detail} language="en" t={t} />
      </QueryClientProvider>
    )
  );
}

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

describe('BoardingPassUpload', () => {
  it('asks for a photo of the boarding pass before one is uploaded', () => {
    renderUpload();

    expect(screen.getByText('Boarding pass')).toBeOnTheScreen();
    expect(screen.getByText('Upload a clear photo of your boarding pass. Make sure your name, flight number and barcode are easy to read.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose file' })).toBeOnTheScreen();
  });

  it('once uploaded, offers to take another photo or view the one sent', () => {
    renderUpload(flight({ boardingPassUploadedAt: '2026-09-20T11:05:00Z' }));

    expect(screen.getByText('Uploaded on 20/09/2026')).toBeOnTheScreen();
    expect(screen.getByText('Tap View to check your photo. If it is blurry or not your boarding pass, take a new photo to replace it.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'View' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Choose file' })).toBeNull();
  });

  it('opens the uploaded photo through a short-lived link on our own API', async () => {
    // The link is resolved against the configured API origin, and fails closed without one.
    const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000/api/v1';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.mocked(candidateFlightDetailClient.requestBoardingPassAccess).mockResolvedValue({
      flightDetailId: '3fa1d41e-d4aa-4bf3-9838-c0af7080f363',
      url: '/rails/active_storage/blobs/proxy/abc/boarding-pass.jpg?disposition=inline',
      expiresAt: '2026-09-20T11:10:00Z',
    });
    renderUpload(flight({ boardingPassUploadedAt: '2026-09-20T11:05:00Z' }));

    fireEvent.press(screen.getByRole('button', { name: 'View' }));

    await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
    expect(candidateFlightDetailClient.requestBoardingPassAccess).toHaveBeenCalledWith('candidate-token');
    expect(openURL.mock.calls[0][0]).toBe('http://localhost:3000/rails/active_storage/blobs/proxy/abc/boarding-pass.jpg?disposition=inline');
    openURL.mockRestore();
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  });

  it('explains when the photo cannot be opened', async () => {
    jest.mocked(candidateFlightDetailClient.requestBoardingPassAccess).mockRejectedValue({ code: 'NETWORK_ERROR' });
    renderUpload(flight({ boardingPassUploadedAt: '2026-09-20T11:05:00Z' }));

    fireEvent.press(screen.getByRole('button', { name: 'View' }));

    expect(await screen.findByText('We couldn’t open your boarding pass. Please try again.')).toBeOnTheScreen();
  });

  it('uploads a camera photo of the boarding pass', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [pickedAsset()] } as never);
    jest.mocked(candidateFlightDetailClient.uploadBoardingPass).mockResolvedValue(flight({ boardingPassUploadedAt: '2026-09-20T11:05:00Z' }));
    renderUpload();

    fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    await waitFor(() => expect(candidateFlightDetailClient.uploadBoardingPass).toHaveBeenCalledTimes(1));
    const { accessToken, formData } = jest.mocked(candidateFlightDetailClient.uploadBoardingPass).mock.calls[0][0];
    expect(accessToken).toBe('candidate-token');
    expect(formData).toBeInstanceOf(FormData);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.not.objectContaining({ allowsEditing: true }));
  });

  it('refuses a photo over 10 MB without uploading it', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [pickedAsset({ fileSize: 11 * 1024 * 1024 })] } as never);
    renderUpload();

    fireEvent.press(screen.getByRole('button', { name: 'Choose file' }));

    expect(await screen.findByText('Choose a photo of 10 MB or less.')).toBeOnTheScreen();
    expect(candidateFlightDetailClient.uploadBoardingPass).not.toHaveBeenCalled();
  });

  it('explains a denied camera permission', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true } as never);
    renderUpload();

    fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(await screen.findByText('Allow camera access to take a photo.')).toBeOnTheScreen();
  });

  it('shows the backend message when the upload is refused', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: false, assets: [pickedAsset()] } as never);
    jest.mocked(candidateFlightDetailClient.uploadBoardingPass).mockRejectedValue({ code: 'UNSUPPORTED_FILE_TYPE', message: 'Upload a JPEG, PNG or WebP image.' });
    renderUpload();

    fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(await screen.findByText('Upload a JPEG, PNG or WebP image.')).toBeOnTheScreen();
  });
});
