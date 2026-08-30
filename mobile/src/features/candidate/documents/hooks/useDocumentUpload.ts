import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { candidateDocumentsClient } from '../../../../lib/candidate-documents-client';
import type { CandidateDocumentChecklistItem, CandidateDocumentsError } from '../../../../lib/candidate-documents-client';
import {
  clearIdempotencyKey,
  EMPTY_IDEMPOTENCY_KEY_STATE,
  randomIdempotencyKey,
  resolveIdempotencyKey,
  type IdempotencyKeyState,
} from '../../../../../../shared/candidateDocuments/idempotency';
import { validateSelectedFile, type FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { PCC_REQUIREMENT_CODE, validatePccIssueDate, type PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/** iOS/Android both report `size`/`mimeType` on a picked asset, but neither is guaranteed on every device/provider -- validation and the idempotency signature both tolerate either being absent, matching web's handling of a platform that doesn't report a MIME type. */
export type PickedDocument = DocumentPicker.DocumentPickerAsset;

interface UploadVariables {
  requirementCode: string;
  document: PickedDocument;
  issuedOn: string;
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

/**
 * Set when a camera/gallery permission request came back denied, so the
 * panel can show localized recovery guidance next to the capture buttons
 * instead of silently doing nothing. `blocked` distinguishes "permanently
 * denied -- only Settings can fix this" (`canAskAgain: false`) from a
 * transient denial the candidate can retry from within the app.
 */
export interface CapturePermissionNotice {
  source: 'camera' | 'gallery';
  blocked: boolean;
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * `expo-image-picker` reports a photo/video asset's name as `fileName`
 * (nullable) and size as `fileSize`, unlike `expo-document-picker`'s
 * `name`/`size` -- normalized here to the exact same `PickedDocument` shape
 * so validation, the idempotency signature and `buildFormData` never need
 * to know which source an asset came from. `lastModified` isn't reported by
 * the image picker at all; the exact value only matters for detecting an
 * unchanged retry within one picking session, so "now" is a safe default.
 */
function toPickedDocument(asset: ImagePicker.ImagePickerAsset, fallbackPrefix: string): PickedDocument {
  const mimeType = asset.mimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `${fallbackPrefix}-${Date.now()}.${extension}`,
    size: asset.fileSize,
    mimeType,
    lastModified: Date.now(),
  };
}

/**
 * Includes `issuedOn` so a candidate editing the PCC issue date between
 * attempts is treated the same as picking a different file -- the backend's
 * own idempotency fingerprint (Candidates::Documents::UploadFingerprint)
 * hashes `issued_on` alongside the file, so reusing a key across a changed
 * date would otherwise surface as a confusing idempotency_conflict instead
 * of just starting a fresh attempt.
 */
function documentSignature(document: PickedDocument, issuedOn: string): string {
  return `${document.uri}:${document.size ?? 'unknown'}:${document.lastModified}:${issuedOn}`;
}

/**
 * Builds the multipart body for a picked document. React Native's `fetch`/
 * `FormData` accept a `{ uri, name, type }` part in place of a real `Blob`
 * for a file field -- this is the standard RN upload pattern, distinct from
 * web's real `File` object, and is never used outside this mobile module
 * (ticket: "React Native document-picker file objects belong in mobile
 * code.").
 *
 * `issuedOn` is only appended for the police_character requirement -- the
 * backend rejects the request entirely if `expires_on` is ever supplied by
 * the client (PccExpiryNotEditableError), so that field is never sent here
 * at all; expiry is always server-calculated.
 */
function buildFormData(requirementCode: string, document: PickedDocument, issuedOn: string): FormData {
  const formData = new FormData();
  formData.append('candidate_document[requirement_code]', requirementCode);
  formData.append(
    'candidate_document[file]',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN's FormData typing models web's Blob-only signature; the platform's actual runtime accepts this shape for a file part.
    {
      uri: document.uri,
      name: document.name,
      type: document.mimeType || 'application/octet-stream',
    } as any
  );
  if (requirementCode === PCC_REQUIREMENT_CODE && issuedOn.trim()) {
    formData.append('candidate_document[issued_on]', issuedOn.trim());
  }
  return formData;
}

/**
 * Owns the single active "upload or replace" flow across the whole
 * checklist -- mirrors web/src/features/candidate/documents/hooks/useDocumentUpload.ts's
 * design and every idempotency/race-safety rule it documents, swapping the
 * browser `File` for an `expo-document-picker` asset, and additionally
 * collects the PCC issue date the police_character requirement now requires.
 */
export function useDocumentUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [activeRequirementCode, setActiveRequirementCode] = useState<string | null>(null);
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [issuedOn, setIssuedOnState] = useState('');
  const [issuedOnError, setIssuedOnError] = useState<PccIssueDateError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);
  const [permissionNotice, setPermissionNotice] = useState<CapturePermissionNotice | null>(null);

  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = activeRequirementCode;

  const isPccRequirement = activeRequirementCode === PCC_REQUIREMENT_CODE;

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: async ({ requirementCode, document, issuedOn, idempotencyKey, accessTokenAtCallTime }) => {
      let formData: FormData;
      try {
        formData = buildFormData(requirementCode, document, issuedOn);
      } catch {
        // The picked file (or its cached copy) is no longer accessible on
        // disk -- caught here rather than left to crash the app (ticket:
        // "Handle inaccessible/deleted local files.").
        throw { code: 'UNKNOWN' } satisfies CandidateDocumentsError;
      }
      return candidateDocumentsClient.uploadDocument({
        accessToken: accessTokenAtCallTime,
        requirementCode,
        formData,
        idempotencyKey,
      });
    },
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(documentQueries.candidateChecklist(candidateId, language), (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      // A new/replaced document changes required-document counts, submission
      // state, compliance and the next recommended action -- all served by
      // the same application-progress response that Dashboard, Status and
      // Profile already read. Without this, those screens would keep
      // showing stale counts/next-action until their own query happened to
      // refetch on its own (focus/pull-to-refresh), even though the
      // checklist row above already updated (ticket: "refresh/invalidate
      // ... Application progress, Dashboard next action, Relevant
      // profile/document summaries").
      queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActiveRequirementCode(null);
        setDocument(null);
        setValidationError(null);
        setIssuedOnState('');
        setIssuedOnError(null);
        setIdempotencyState(clearIdempotencyKey());
      }
    },
    onError: (error) => {
      if (error.code === 'CONFLICT' || error.code === 'REPLACEMENT_NOT_ALLOWED') {
        setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      }
      if (error.code === 'REPLACEMENT_NOT_ALLOWED') {
        queryClient.invalidateQueries({ queryKey: documentQueries.candidateChecklist(candidateId, language) });
      }
      // VALIDATION_ERROR (a bad/missing PCC issue date): the panel stays
      // open with the typed date preserved so the candidate can fix it --
      // resolveIdempotencyKey below already mints a fresh key on the next
      // submit if they change the date, and reuses the same one if they
      // don't, matching the backend's own fingerprint (which hashes
      // issued_on alongside the file).
    },
  });

  const startUpload = useCallback(
    (requirementCode: string) => {
      setActiveRequirementCode(requirementCode);
      setDocument(null);
      setValidationError(null);
      setIssuedOnState('');
      setIssuedOnError(null);
      setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      setPermissionNotice(null);
      mutation.reset();
    },
    [mutation]
  );

  const cancelUpload = useCallback(() => {
    setActiveRequirementCode(null);
    setDocument(null);
    setValidationError(null);
    setIssuedOnState('');
    setIssuedOnError(null);
    setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
    setPermissionNotice(null);
    mutation.reset();
  }, [mutation]);

  /** Opens the native document/file picker and applies its result -- a cancellation is a normal, silent no-op, never an error (ticket: "Handle picker cancellation as a normal non-error state."). No permission is required for this picker (it's the system's own file/Files-app UI, not the camera or photo library), so it stays available even when camera/gallery access is denied or blocked. */
  const pickDocument = useCallback(async () => {
    if (!activeRequirementCode) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPermissionNotice(null);
    setDocument(asset);
    setValidationError(validateSelectedFile({ name: asset.name, size: asset.size, type: asset.mimeType }));
    mutation.reset();
  }, [activeRequirementCode, mutation]);

  const applyPickedImage = useCallback(
    (result: ImagePicker.ImagePickerResult, fallbackPrefix: string) => {
      if (result.canceled) return;
      const asset = toPickedDocument(result.assets[0], fallbackPrefix);
      setPermissionNotice(null);
      setDocument(asset);
      setValidationError(validateSelectedFile({ name: asset.name, size: asset.size, type: asset.mimeType }));
      mutation.reset();
    },
    [mutation]
  );

  /**
   * Opens the camera, requesting permission first. A cancelled capture is a
   * silent no-op, same as `pickDocument`. A denied/blocked permission sets
   * `permissionNotice` instead of throwing or silently doing nothing, so the
   * panel can show localized recovery guidance (and an Open Settings action
   * when the OS will no longer prompt again) -- the candidate can always
   * fall back to `pickDocument` regardless of this outcome.
   */
  const pickFromCamera = useCallback(async () => {
    if (!activeRequirementCode) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice({ source: 'camera', blocked: !permission.canAskAgain });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    applyPickedImage(result, 'photo');
  }, [activeRequirementCode, applyPickedImage]);

  /** Opens the photo library, requesting permission first -- mirrors `pickFromCamera`'s permission/cancellation handling exactly. */
  const pickFromGallery = useCallback(async () => {
    if (!activeRequirementCode) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice({ source: 'gallery', blocked: !permission.canAskAgain });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    applyPickedImage(result, 'image');
  }, [activeRequirementCode, applyPickedImage]);

  const removeDocument = useCallback(() => {
    setDocument(null);
    setValidationError(null);
    setPermissionNotice(null);
    mutation.reset();
  }, [mutation]);

  const setIssuedOn = useCallback((value: string) => {
    setIssuedOnState(value);
    setIssuedOnError(null);
  }, []);

  const submit = useCallback(() => {
    if (!document || !activeRequirementCode || !session || mutation.isPending) return;
    const fileError = validateSelectedFile({ name: document.name, size: document.size, type: document.mimeType });
    setValidationError(fileError);
    if (fileError) return;

    if (isPccRequirement) {
      const dateError = validatePccIssueDate(issuedOn);
      setIssuedOnError(dateError);
      if (dateError) return;
    }

    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: activeRequirementCode, fileSignature: documentSignature(document, issuedOn) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: activeRequirementCode,
      document,
      issuedOn,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [document, activeRequirementCode, session, idempotencyState, mutation, isPccRequirement, issuedOn]);

  return {
    activeRequirementCode,
    document,
    validationError,
    isPccRequirement,
    issuedOn,
    setIssuedOn,
    issuedOnError,
    permissionNotice,
    startUpload,
    cancelUpload,
    pickDocument,
    pickFromCamera,
    pickFromGallery,
    removeDocument,
    submit,
    retry: submit,
    mutation,
  };
}
