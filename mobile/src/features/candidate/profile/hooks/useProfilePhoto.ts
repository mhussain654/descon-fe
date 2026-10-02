import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';
import type { ProfilePhotoError } from '../../../../../../shared/candidateProfile/types';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type ProfilePhotoProblem =
  | { kind: 'too_large' }
  | { kind: 'unsupported' }
  | { kind: 'permission'; source: 'camera' | 'gallery'; blocked: boolean }
  | { kind: 'failed'; error: ProfilePhotoError };

/**
 * Builds the multipart body for a picked photo -- a React Native file part on
 * native, the browser's real `File` on web (same split as the document and
 * bank-detail uploads: a browser FormData would stringify the RN part).
 */
export function buildProfilePhotoFormData(asset: ImagePicker.ImagePickerAsset): FormData {
  const mimeType = asset.mimeType || 'image/jpeg';
  const name = asset.fileName || `profile-photo.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
  const formData = new FormData();
  if (asset.file) {
    formData.append('profile_photo[photo]', asset.file, name);
  } else {
    formData.append('profile_photo[photo]', { uri: asset.uri, name, type: mimeType } as unknown as Blob);
  }
  return formData;
}

/**
 * Lets the signed-in candidate set (camera or gallery, square-cropped),
 * replace or remove their own profile photo, then refreshes the profile so
 * every screen picks up the new short-lived photo link. Validates type/size
 * up front for a fast, clear message; the backend re-checks both.
 */
export function useProfilePhoto() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<ProfilePhotoProblem | null>(null);
  const accessToken = (session as { accessToken: string } | null)?.accessToken ?? '';
  const candidateId = (session as { candidateId: string } | null)?.candidateId ?? 'anonymous';

  const refreshProfile = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['profile', 'candidate', candidateId] }),
    [queryClient, candidateId]
  );

  const upload = useMutation({
    mutationFn: (asset: ImagePicker.ImagePickerAsset) =>
      candidateProfileClient.uploadPhoto({ accessToken, formData: buildProfilePhotoFormData(asset) }),
    onSuccess: refreshProfile,
    onError: (error: ProfilePhotoError) => setProblem({ kind: 'failed', error }),
  });

  const remove = useMutation({
    mutationFn: () => candidateProfileClient.removePhoto(accessToken),
    onSuccess: refreshProfile,
    onError: (error: ProfilePhotoError) => setProblem({ kind: 'failed', error }),
  });

  const submit = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const type = asset.mimeType || 'image/jpeg';
      if (!ALLOWED_TYPES.includes(type)) return setProblem({ kind: 'unsupported' });
      if (asset.fileSize && asset.fileSize > PROFILE_PHOTO_MAX_BYTES) return setProblem({ kind: 'too_large' });
      setProblem(null);
      upload.mutate(asset);
    },
    [upload]
  );

  const pick = useCallback(
    async (source: 'camera' | 'gallery') => {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setProblem({ kind: 'permission', source, blocked: !permission.canAskAgain });
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 };
      const result =
        source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      submit(result.assets[0]);
    },
    [submit]
  );

  return {
    takePhoto: () => pick('camera'),
    chooseFromGallery: () => pick('gallery'),
    removePhoto: () => {
      setProblem(null);
      remove.mutate();
    },
    isSaving: upload.isPending || remove.isPending,
    problem,
    clearProblem: () => setProblem(null),
  };
}
