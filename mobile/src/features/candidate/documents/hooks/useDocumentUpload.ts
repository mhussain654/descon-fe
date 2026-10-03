import { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  appendEntries,
  layoutFor,
  orderedEntries,
  replaceSlot,
  validateFileSet,
  type FileSetEntry,
  type FileSetLayout,
  type FileSetValidationError,
  type PairUploadMode,
} from '../../../../../../shared/candidateDocuments/fileSet';
import type { SelectedFileDescriptor } from '../../../../../../shared/candidateDocuments/fileValidation';
import { PCC_REQUIREMENT_CODE, validatePccIssueDate, type PccIssueDateError } from '../../../../../../shared/candidateDocuments/pccIssueDate';
import type { DocumentSideCode, DocumentUploadRules } from '../../../../../../shared/candidateDocuments/types';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';

/** iOS/Android both report `size`/`mimeType` on a picked asset, but neither is guaranteed on every device/provider -- validation and the idempotency signature both tolerate either being absent. */
export type PickedDocument = DocumentPicker.DocumentPickerAsset;

/** A picked asset reduced to the descriptor shared validation reads, keeping the asset for upload. */
export interface PickedFile extends SelectedFileDescriptor {
  asset: PickedDocument;
}

export type PickSource = 'file' | 'camera' | 'gallery';

interface UploadVariables {
  requirementCode: string;
  entries: FileSetEntry<PickedFile>[];
  issuedOn: string;
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

/**
 * Set when a camera/gallery permission request came back denied, so the
 * panel can show localized recovery guidance instead of silently doing
 * nothing. `blocked` means only Settings can fix it (`canAskAgain: false`).
 */
export interface CapturePermissionNotice {
  source: 'camera' | 'gallery';
  blocked: boolean;
}

function toPickedFile(asset: PickedDocument): PickedFile {
  return { name: asset.name, size: asset.size, type: asset.mimeType, asset };
}

/**
 * `expo-image-picker` reports a photo's name as `fileName` (nullable) and its
 * size as `fileSize`, unlike `expo-document-picker`'s `name`/`size` --
 * normalized here to the same `PickedDocument` shape. `lastModified` isn't
 * reported by the image picker; "now" is a safe default since it only
 * distinguishes an unchanged retry within one picking session.
 */
function fromImageAsset(asset: ImagePicker.ImagePickerAsset, fallbackPrefix: string): PickedDocument {
  const mimeType = asset.mimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `${fallbackPrefix}-${Date.now()}.${extension}`,
    size: asset.fileSize,
    mimeType,
    lastModified: Date.now(),
    // Web-only: both pickers hand back a real File on Expo web (see buildFormData).
    file: asset.file,
  };
}

/** Identifies the whole file set plus the PCC issue date, matching the backend's own idempotency fingerprint. */
function fileSetSignature(entries: FileSetEntry<PickedFile>[], issuedOn: string): string {
  const files = entries.map(
    ({ sideCode, file }) => `${sideCode ?? '-'}:${file.asset.uri}:${file.size ?? 'unknown'}:${file.asset.lastModified}`
  );
  return `${files.join('|')}#${issuedOn}`;
}

/**
 * Builds the multipart body: each file as `files[][file]` plus its part label
 * (`files[][side_code]`) when the requirement uses labels. Native React
 * Native accepts a `{ uri, name, type }` part for a file field; on Expo web
 * the browser's FormData needs the picker's real `File` instead (a plain
 * object would be stringified). `issued_on` is only sent for the PCC
 * requirement; `expires_on` never -- the backend always calculates it.
 */
export function buildFormData(requirementCode: string, entries: FileSetEntry<PickedFile>[], issuedOn: string): FormData {
  const formData = new FormData();
  formData.append('candidate_document[requirement_code]', requirementCode);
  for (const { sideCode, file } of entries) {
    const { asset } = file;
    if (asset.file) {
      formData.append('candidate_document[files][][file]', asset.file, asset.name);
    } else {
      formData.append(
        'candidate_document[files][][file]',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN's FormData typing models web's Blob-only signature; the platform's runtime accepts this shape for a file part.
        { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' } as any
      );
    }
    if (sideCode) formData.append('candidate_document[files][][side_code]', sideCode);
  }
  if (requirementCode === PCC_REQUIREMENT_CODE && issuedOn.trim()) {
    formData.append('candidate_document[issued_on]', issuedOn.trim());
  }
  return formData;
}

interface ActiveRequirement {
  requirementCode: string;
  rules: DocumentUploadRules;
}

/**
 * Owns the single active "upload or replace" flow across the whole checklist
 * -- mirrors web's useDocumentUpload.ts: the selected file set is shaped by
 * the requirement's backend rules (shared/candidateDocuments/fileSet.ts),
 * swapping the browser File for picker assets (file, camera or gallery).
 */
export function useDocumentUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [active, setActive] = useState<ActiveRequirement | null>(null);
  const [mode, setModeState] = useState<PairUploadMode>('parts');
  const [entries, setEntries] = useState<FileSetEntry<PickedFile>[]>([]);
  const [showSetError, setShowSetError] = useState(false);
  const [issuedOn, setIssuedOnState] = useState('');
  const [issuedOnError, setIssuedOnError] = useState<PccIssueDateError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);
  const [permissionNotice, setPermissionNotice] = useState<CapturePermissionNotice | null>(null);

  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = active?.requirementCode ?? null;

  const layout: FileSetLayout | null = useMemo(() => (active ? layoutFor(active.rules) : null), [active]);
  const validation: FileSetValidationError | null = useMemo(
    () => (active ? validateFileSet(active.rules, entries) : null),
    [active, entries]
  );
  const isPccRequirement = active?.requirementCode === PCC_REQUIREMENT_CODE;

  const resetSelection = useCallback(() => {
    setEntries([]);
    setShowSetError(false);
    setIssuedOnState('');
    setIssuedOnError(null);
    setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
    setPermissionNotice(null);
  }, []);

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: async ({ requirementCode, entries: files, issuedOn: date, idempotencyKey, accessTokenAtCallTime }) => {
      let formData: FormData;
      try {
        formData = buildFormData(requirementCode, files, date);
      } catch {
        // A picked file (or its cached copy) is no longer accessible on disk.
        throw { code: 'UNKNOWN' } satisfies CandidateDocumentsError;
      }
      return candidateDocumentsClient.uploadDocument({ accessToken: accessTokenAtCallTime, requirementCode, formData, idempotencyKey });
    },
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(documentQueries.candidateChecklist(candidateId, language), (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      // Counts, submission state and the next action on Dashboard/Status/
      // Profile all come from application progress -- refresh it too.
      queryClient.invalidateQueries({ queryKey: documentQueries.applicationProgress(candidateId, language) });
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActive(null);
        resetSelection();
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
    },
  });

  const startUpload = useCallback(
    (item: Pick<CandidateDocumentChecklistItem, 'requirementCode' | 'uploadRules'>) => {
      setActive({ requirementCode: item.requirementCode, rules: item.uploadRules });
      const nextLayout = layoutFor(item.uploadRules);
      setModeState(item.requirementCode === 'passport' && nextLayout.kind === 'pair' && nextLayout.combinedAllowed ? 'combined' : 'parts');
      resetSelection();
      mutation.reset();
    },
    [mutation, resetSelection]
  );

  const cancelUpload = useCallback(() => {
    setActive(null);
    resetSelection();
    mutation.reset();
  }, [mutation, resetSelection]);

  /** Switching between one combined PDF and separate parts starts the selection over. */
  const setMode = useCallback(
    (nextMode: PairUploadMode) => {
      if (nextMode === mode || mutation.isPending) return;
      setModeState(nextMode);
      setEntries([]);
      setShowSetError(false);
      mutation.reset();
    },
    [mode, mutation]
  );

  /** Places picked assets: into a repeatable list (`multiple` layout) or into the given slot. */
  const placeAssets = useCallback(
    (assets: PickedDocument[], sideCode: DocumentSideCode | null) => {
      if (!layout || assets.length === 0) return;
      const files = assets.map(toPickedFile);
      setPermissionNotice(null);
      setEntries((current) =>
        layout.kind === 'multiple'
          ? appendEntries(current, layout.sideCode, files, layout.maximumFiles)
          : replaceSlot(current, sideCode, files[0])
      );
      mutation.reset();
    },
    [layout, mutation]
  );

  /**
   * Opens a picker for one slot (or, for a repeatable document, to add files).
   * A cancelled pick is a silent no-op. The file picker needs no permission;
   * a denied camera/gallery permission sets `permissionNotice` instead.
   */
  const pick = useCallback(
    async (source: PickSource, sideCode: DocumentSideCode | null) => {
      if (!active || !layout) return;
      const allowsMultiple = layout.kind === 'multiple';

      if (source === 'file') {
        const result = await DocumentPicker.getDocumentAsync({
          type: sideCode === 'combined' ? ['application/pdf'] : [...active.rules.acceptedContentTypes],
          copyToCacheDirectory: true,
          multiple: allowsMultiple,
        });
        if (!result.canceled) placeAssets(result.assets, sideCode);
        return;
      }

      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPermissionNotice({ source, blocked: !permission.canAskAgain });
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              allowsMultipleSelection: allowsMultiple,
            });
      if (result.canceled) return;
      placeAssets(
        result.assets.map((asset) => fromImageAsset(asset, source === 'camera' ? 'photo' : 'image')),
        sideCode
      );
    },
    [active, layout, placeAssets]
  );

  /** Empties one slot. */
  const removeSlot = useCallback(
    (sideCode: DocumentSideCode | null) => {
      setEntries((current) => replaceSlot(current, sideCode, null));
      mutation.reset();
    },
    [mutation]
  );

  /** Removes one file from a repeatable document's list. */
  const removeFileAt = useCallback(
    (index: number) => {
      setEntries((current) => current.filter((_, position) => position !== index));
      mutation.reset();
    },
    [mutation]
  );

  const setIssuedOn = useCallback((value: string) => {
    setIssuedOnState(value);
    setIssuedOnError(null);
  }, []);

  const submit = useCallback(() => {
    if (!active || !layout || !session || mutation.isPending) return;
    setShowSetError(true);
    if (validation) return;

    if (isPccRequirement) {
      const dateError = validatePccIssueDate(issuedOn);
      setIssuedOnError(dateError);
      if (dateError) return;
    }

    const files = orderedEntries(layout, entries);
    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: active.requirementCode, fileSignature: fileSetSignature(files, issuedOn) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: active.requirementCode,
      entries: files,
      issuedOn,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [active, layout, session, mutation, validation, isPccRequirement, issuedOn, entries, idempotencyState]);

  return {
    activeRequirementCode: active?.requirementCode ?? null,
    rules: active?.rules ?? null,
    layout,
    mode,
    setMode,
    entries,
    validation,
    showSetError,
    isPccRequirement,
    issuedOn,
    setIssuedOn,
    issuedOnError,
    permissionNotice,
    startUpload,
    cancelUpload,
    pick,
    removeSlot,
    removeFileAt,
    submit,
    retry: submit,
    mutation,
  };
}

export type DocumentUploadController = ReturnType<typeof useDocumentUpload>;
