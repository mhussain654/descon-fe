import { useCallback, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
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
import { CANDIDATE_DOCUMENTS_QUERY_KEY } from './useCandidateDocuments';

/** iOS/Android both report `size`/`mimeType` on a picked asset, but neither is guaranteed on every device/provider -- validation and the idempotency signature both tolerate either being absent, matching web's handling of a platform that doesn't report a MIME type. */
export type PickedDocument = DocumentPicker.DocumentPickerAsset;

interface UploadVariables {
  requirementCode: string;
  document: PickedDocument;
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function documentSignature(document: PickedDocument): string {
  return `${document.uri}:${document.size ?? 'unknown'}:${document.lastModified}`;
}

/**
 * Builds the multipart body for a picked document. React Native's `fetch`/
 * `FormData` accept a `{ uri, name, type }` part in place of a real `Blob`
 * for a file field -- this is the standard RN upload pattern, distinct from
 * web's real `File` object, and is never used outside this mobile module
 * (ticket: "React Native document-picker file objects belong in mobile
 * code.").
 */
function buildFormData(requirementCode: string, document: PickedDocument): FormData {
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
  return formData;
}

/**
 * Owns the single active "upload or replace" flow across the whole
 * checklist -- mirrors web/src/features/candidate/documents/hooks/useDocumentUpload.ts's
 * design and every idempotency/race-safety rule it documents, swapping the
 * browser `File` for an `expo-document-picker` asset.
 */
export function useDocumentUpload() {
  const { session } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [activeRequirementCode, setActiveRequirementCode] = useState<string | null>(null);
  const [document, setDocument] = useState<PickedDocument | null>(null);
  const [validationError, setValidationError] = useState<FileValidationError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<IdempotencyKeyState>(EMPTY_IDEMPOTENCY_KEY_STATE);

  const activeRequirementCodeRef = useRef<string | null>(null);
  activeRequirementCodeRef.current = activeRequirementCode;

  const mutation = useMutation<CandidateDocumentChecklistItem, CandidateDocumentsError, UploadVariables>({
    mutationFn: async ({ requirementCode, document, idempotencyKey, accessTokenAtCallTime }) => {
      let formData: FormData;
      try {
        formData = buildFormData(requirementCode, document);
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

      queryClient.setQueryData<CandidateDocumentChecklistItem[]>(CANDIDATE_DOCUMENTS_QUERY_KEY, (old) =>
        old ? old.map((item) => (item.requirementCode === result.requirementCode ? result : item)) : old
      );
      toast.success(t('candidateDocumentsUploadSuccessToast'));

      if (activeRequirementCodeRef.current === result.requirementCode) {
        setActiveRequirementCode(null);
        setDocument(null);
        setValidationError(null);
        setIdempotencyState(clearIdempotencyKey());
      }
    },
    onError: (error) => {
      if (error.code === 'CONFLICT' || error.code === 'REPLACEMENT_NOT_ALLOWED') {
        setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      }
      if (error.code === 'REPLACEMENT_NOT_ALLOWED') {
        queryClient.invalidateQueries({ queryKey: CANDIDATE_DOCUMENTS_QUERY_KEY });
      }
    },
  });

  const startUpload = useCallback(
    (requirementCode: string) => {
      setActiveRequirementCode(requirementCode);
      setDocument(null);
      setValidationError(null);
      setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
      mutation.reset();
    },
    [mutation]
  );

  const cancelUpload = useCallback(() => {
    setActiveRequirementCode(null);
    setDocument(null);
    setValidationError(null);
    setIdempotencyState(EMPTY_IDEMPOTENCY_KEY_STATE);
    mutation.reset();
  }, [mutation]);

  /** Opens the native picker and applies its result -- a cancellation is a normal, silent no-op, never an error (ticket: "Handle picker cancellation as a normal non-error state."). */
  const pickDocument = useCallback(async () => {
    if (!activeRequirementCode) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setDocument(asset);
    setValidationError(validateSelectedFile({ name: asset.name, size: asset.size, type: asset.mimeType }));
    mutation.reset();
  }, [activeRequirementCode, mutation]);

  const removeDocument = useCallback(() => {
    setDocument(null);
    setValidationError(null);
    mutation.reset();
  }, [mutation]);

  const submit = useCallback(() => {
    if (!document || !activeRequirementCode || !session || mutation.isPending) return;
    const error = validateSelectedFile({ name: document.name, size: document.size, type: document.mimeType });
    setValidationError(error);
    if (error) return;

    const resolved = resolveIdempotencyKey(
      idempotencyState,
      { requirementCode: activeRequirementCode, fileSignature: documentSignature(document) },
      randomIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      requirementCode: activeRequirementCode,
      document,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [document, activeRequirementCode, session, idempotencyState, mutation]);

  return {
    activeRequirementCode,
    document,
    validationError,
    startUpload,
    cancelUpload,
    pickDocument,
    removeDocument,
    submit,
    retry: submit,
    mutation,
  };
}
