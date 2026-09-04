import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { candidateBankDetailsClient } from '../../../../lib/candidate-bank-details-client';
import type { CandidateBankDetailsError, CandidateBankDetailSummary } from '../../../../lib/candidate-bank-details-client';
import {
  clearBankDetailIdempotencyKey,
  EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE,
  randomBankDetailIdempotencyKey,
  resolveBankDetailIdempotencyKey,
  type BankDetailIdempotencyKeyState,
} from '../../../../../../shared/candidateBankDetails/idempotency';
import { validateBankDetailFields, hasBankDetailFormErrors, type BankDetailFormErrors } from '../../../../../../shared/candidateBankDetails/formValidation';
import { validateSelectedFile, type FileValidationError } from '../../../../../../shared/candidateDocuments/fileValidation';
import { documentQueries } from '../../../../../../shared/queryKeys/documentQueries';
import type { CapturePermissionNotice } from './useDocumentUpload';

/** Same normalized shape useDocumentUpload.ts's PickedDocument uses -- one file representation across both upload flows regardless of which native picker produced it. */
export type PickedProof = DocumentPicker.DocumentPickerAsset;

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Mirrors useDocumentUpload.ts's identical helper -- normalizes an expo-image-picker asset into the same shape a document-picker asset already has. */
function toPickedProof(asset: ImagePicker.ImagePickerAsset, fallbackPrefix: string): PickedProof {
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

/** Editing any field between attempts is a fresh submission, not a retry -- mirrors useDocumentUpload.ts's documentSignature rationale. */
function contentSignature(accountTitle: string, accountNumber: string, bankName: string, proof: PickedProof): string {
  return `${accountTitle}:${accountNumber}:${bankName}:${proof.uri}:${proof.size ?? 'unknown'}:${proof.lastModified}`;
}

/**
 * Builds the multipart body for a picked proof file -- React Native's
 * `fetch`/`FormData` accept a `{ uri, name, type }` part in place of a real
 * `Blob`, mirroring useDocumentUpload.ts's buildFormData exactly.
 */
function buildFormData(accountTitle: string, accountNumber: string, bankName: string, proof: PickedProof): FormData {
  const formData = new FormData();
  formData.append('bank_detail[account_title]', accountTitle);
  formData.append('bank_detail[account_number]', accountNumber);
  formData.append('bank_detail[bank_name]', bankName);
  formData.append(
    'bank_detail[proof]',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RN's FormData typing models web's Blob-only signature; the platform's actual runtime accepts this shape for a file part.
    { uri: proof.uri, name: proof.name, type: proof.mimeType || 'application/octet-stream' } as any
  );
  return formData;
}

interface SubmitVariables {
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  proof: PickedProof;
  idempotencyKey: string;
  accessTokenAtCallTime: string;
}

/**
 * Owns the bank-details form's field state, native file/camera/gallery
 * picking, client-side validation, and the submit mutation -- mirrors
 * useDocumentUpload.ts's design and web's useBankDetailUpload.ts's field
 * handling, swapping the browser `File` for an expo-document-picker/
 * image-picker asset.
 */
export function useBankDetailUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [proof, setProof] = useState<PickedProof | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BankDetailFormErrors>({});
  const [proofError, setProofError] = useState<FileValidationError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<BankDetailIdempotencyKeyState>(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE);
  const [permissionNotice, setPermissionNotice] = useState<CapturePermissionNotice | null>(null);

  const mutation = useMutation<CandidateBankDetailSummary, CandidateBankDetailsError, SubmitVariables>({
    mutationFn: async ({ accountTitle, accountNumber, bankName, proof, idempotencyKey, accessTokenAtCallTime }) => {
      let formData: FormData;
      try {
        formData = buildFormData(accountTitle, accountNumber, bankName, proof);
      } catch {
        // The picked file (or its cached copy) is no longer accessible on
        // disk -- caught here rather than left to crash the app, mirroring
        // useDocumentUpload.ts's identical guard.
        throw { code: 'UNKNOWN' } satisfies CandidateBankDetailsError;
      }
      return candidateBankDetailsClient.submitBankDetail({ accessToken: accessTokenAtCallTime, formData, idempotencyKey });
    },
    onSuccess: (result, variables) => {
      if (session?.accessToken !== variables.accessTokenAtCallTime) return;

      queryClient.setQueryData(documentQueries.bankDetail(candidateId, language), result);
      toast.success(t('candidateBankDetailsSubmitSuccessToast'));

      setAccountTitle('');
      setAccountNumber('');
      setBankName('');
      setProof(null);
      setFieldErrors({});
      setProofError(null);
      setPermissionNotice(null);
      setIdempotencyState(clearBankDetailIdempotencyKey());
    },
    onError: (error) => {
      if (error.code === 'CONFLICT') {
        setIdempotencyState(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE);
      }
    },
  });

  const applyPicked = useCallback((asset: PickedProof) => {
    setPermissionNotice(null);
    setProof(asset);
    setProofError(validateSelectedFile({ name: asset.name, size: asset.size, type: asset.mimeType }));
    mutation.reset();
  }, [mutation]);

  /** Opens the native document/file picker -- mirrors useDocumentUpload.ts's pickDocument exactly, no permission required. */
  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    applyPicked(result.assets[0]);
  }, [applyPicked]);

  /** Mirrors useDocumentUpload.ts's pickFromCamera exactly. */
  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice({ source: 'camera', blocked: !permission.canAskAgain });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    applyPicked(toPickedProof(result.assets[0], 'proof'));
  }, [applyPicked]);

  /** Mirrors useDocumentUpload.ts's pickFromGallery exactly. */
  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionNotice({ source: 'gallery', blocked: !permission.canAskAgain });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    applyPicked(toPickedProof(result.assets[0], 'proof'));
  }, [applyPicked]);

  const removeProof = useCallback(() => {
    setProof(null);
    setProofError(null);
    setPermissionNotice(null);
    mutation.reset();
  }, [mutation]);

  const submit = useCallback(() => {
    if (!session || mutation.isPending) return;

    const errors = validateBankDetailFields({ accountTitle, accountNumber, bankName });
    setFieldErrors(errors);
    const fileError = validateSelectedFile(proof ? { name: proof.name, size: proof.size, type: proof.mimeType } : null);
    setProofError(fileError);
    if (hasBankDetailFormErrors(errors) || fileError || !proof) return;

    const resolved = resolveBankDetailIdempotencyKey(
      idempotencyState,
      { contentSignature: contentSignature(accountTitle, accountNumber, bankName, proof) },
      randomBankDetailIdempotencyKey
    );
    setIdempotencyState(resolved);

    mutation.mutate({
      accountTitle,
      accountNumber,
      bankName,
      proof,
      idempotencyKey: resolved.key as string,
      accessTokenAtCallTime: session.accessToken,
    });
  }, [session, mutation, accountTitle, accountNumber, bankName, proof, idempotencyState]);

  return {
    accountTitle,
    setAccountTitle,
    accountNumber,
    setAccountNumber,
    bankName,
    setBankName,
    proof,
    proofError,
    permissionNotice,
    fieldErrors,
    pickDocument,
    pickFromCamera,
    pickFromGallery,
    removeProof,
    submit,
    mutation,
  };
}
