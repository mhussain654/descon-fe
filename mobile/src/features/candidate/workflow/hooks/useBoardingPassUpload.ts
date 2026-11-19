import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateFlightDetailClient } from '../../../../lib/candidate-flight-detail-client';
import type { CandidateFlightDetailError } from '../../../../lib/candidate-flight-detail-client';
import { toast } from '../../../../design-system/toast';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

export const BOARDING_PASS_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type BoardingPassProblem =
  | { kind: 'too_large' }
  | { kind: 'unsupported' }
  | { kind: 'permission'; source: 'camera' | 'gallery'; blocked: boolean }
  | { kind: 'failed'; error: CandidateFlightDetailError };

/** Multipart body for the picked photo: a React Native file part on native, the real `File` on web. */
export function buildBoardingPassFormData(asset: ImagePicker.ImagePickerAsset): FormData {
  const mimeType = asset.mimeType || 'image/jpeg';
  const name = asset.fileName || `boarding-pass.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
  const formData = new FormData();
  if (asset.file) {
    formData.append('boarding_pass[photo]', asset.file, name);
  } else {
    formData.append('boarding_pass[photo]', { uri: asset.uri, name, type: mimeType } as unknown as Blob);
  }
  return formData;
}

/**
 * Lets the candidate photograph (or pick) their boarding pass and upload it
 * under Mobilize Status, then refreshes the flight detail and progress so the
 * step shows Completed. Checks type and size up front; the backend re-checks.
 */
export function useBoardingPassUpload(t: (key: TranslationKey) => string) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<BoardingPassProblem | null>(null);

  const upload = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) =>
      candidateFlightDetailClient.uploadBoardingPass({
        accessToken: await getAccessToken(),
        formData: buildBoardingPassFormData(asset),
      }),
    onSuccess: async () => {
      toast.success(t('boardingPassUploadedToast'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow', 'flightDetail'] }),
        queryClient.invalidateQueries({ queryKey: ['documents', 'applicationProgress'] }),
      ]);
    },
    onError: (error: CandidateFlightDetailError) => setProblem({ kind: 'failed', error }),
  });

  const submit = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const type = asset.mimeType || 'image/jpeg';
      if (!ALLOWED_TYPES.includes(type)) return setProblem({ kind: 'unsupported' });
      if (asset.fileSize && asset.fileSize > BOARDING_PASS_MAX_BYTES) return setProblem({ kind: 'too_large' });
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
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
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
    isUploading: upload.isPending,
    problem,
  };
}
