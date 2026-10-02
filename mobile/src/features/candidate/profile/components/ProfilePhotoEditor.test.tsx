import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';
import { translations, type TranslationKey } from '../../../../../../shared/i18n/translations';
import { createQueryClientTestLifecycle } from '../../../../testSupport/queryClientTestLifecycle';
import { ProfilePhotoEditor } from './ProfilePhotoEditor';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ session: { accessToken: 'candidate-token', candidateId: 'candidate-1' }, status: 'authenticated' }),
}));

jest.mock('../../../../lib/candidate-profile-client', () => ({
  candidateProfileClient: { uploadPhoto: jest.fn(), removePhoto: jest.fn() },
}));

const t = (key: TranslationKey) => translations.en[key];
const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

function renderEditor(photoUri: string | null = null) {
  return trackRender(
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <ProfilePhotoEditor language="en" t={t} fullName="Ahmed Ali" photoUri={photoUri} />
      </QueryClientProvider>
    )
  );
}

function pickedAsset(overrides: Partial<ImagePicker.ImagePickerAsset> = {}): ImagePicker.ImagePickerAsset {
  return { uri: 'file:///photo.jpg', width: 400, height: 400, mimeType: 'image/jpeg', fileSize: 200_000, fileName: 'photo.jpg', ...overrides } as ImagePicker.ImagePickerAsset;
}

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

describe('ProfilePhotoEditor', () => {
  it('shows the initial and an "Add photo" action when there is no photo', () => {
    renderEditor();

    expect(screen.getByText('A')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeOnTheScreen();
  });

  it('uploads a square-cropped gallery photo for the signed-in candidate', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [pickedAsset()] } as never);
    jest.mocked(candidateProfileClient.uploadPhoto).mockResolvedValue({ photoUrl: '/rails/active_storage/blobs/proxy/x/p.jpg' });
    renderEditor();

    fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));

    await waitFor(() => expect(candidateProfileClient.uploadPhoto).toHaveBeenCalledTimes(1));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
    expect(jest.mocked(candidateProfileClient.uploadPhoto).mock.calls[0][0].accessToken).toBe('candidate-token');
  });

  it('rejects an oversized photo before uploading it', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [pickedAsset({ fileSize: 6 * 1024 * 1024 })],
    } as never);
    renderEditor();

    fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));

    expect(await screen.findByText('Choose a photo of 5 MB or less.')).toBeOnTheScreen();
    expect(candidateProfileClient.uploadPhoto).not.toHaveBeenCalled();
  });

  it('explains a denied camera permission instead of failing silently', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: true } as never);
    renderEditor();

    fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));

    expect(await screen.findByText('Allow camera access to take a photo.')).toBeOnTheScreen();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('shows the backend message when the server rejects the photo', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({ granted: true, canAskAgain: true } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [pickedAsset()] } as never);
    jest.mocked(candidateProfileClient.uploadPhoto).mockRejectedValue({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Upload a JPEG, PNG, or WebP image.',
    });
    renderEditor();

    fireEvent.press(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Choose from gallery' }));

    expect(await screen.findByText('Upload a JPEG, PNG, or WebP image.')).toBeOnTheScreen();
  });

  it('offers removal only when a photo exists, and removes it', async () => {
    jest.mocked(candidateProfileClient.removePhoto).mockResolvedValue({ photoUrl: null });
    renderEditor('https://example.test/photo.jpg');

    fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => expect(candidateProfileClient.removePhoto).toHaveBeenCalledWith('candidate-token'));
  });
});
