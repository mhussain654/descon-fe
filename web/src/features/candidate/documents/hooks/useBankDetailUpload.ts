import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface SubmitVariables {
  accountTitle: string;
  accountNumber: string;
  bankName: string;
  proof: File;
  idempotencyKey: string;
  /** Captured at the moment `mutate()` is called -- see useDocumentUpload.ts's identical field for why. */
  accessTokenAtCallTime: string;
}

/** Editing any field between attempts is a fresh submission, not a retry -- mirrors useDocumentUpload.ts's fileSignature rationale exactly. */
function contentSignature(accountTitle: string, accountNumber: string, bankName: string, proof: File): string {
  return `${accountTitle}:${accountNumber}:${bankName}:${proof.name}:${proof.size}:${proof.lastModified}`;
}

/** Built here, not inside the client -- matches useDocumentUpload.ts's buildFormData being web-owned, so CandidateBankDetailsClient stays platform-agnostic (see BankDetailUpsertParams's doc comment). */
function buildFormData(accountTitle: string, accountNumber: string, bankName: string, proof: File): FormData {
  const formData = new FormData();
  formData.append('bank_detail[account_title]', accountTitle);
  formData.append('bank_detail[account_number]', accountNumber);
  formData.append('bank_detail[bank_name]', bankName);
  formData.append('bank_detail[proof]', proof);
  return formData;
}

/**
 * Owns the bank-details form's field state, client-side validation, and the
 * submit mutation (including its idempotency-key lifecycle) -- mirrors
 * useDocumentUpload.ts's/useInitiateCheckout.ts's identical structure.
 */
export function useBankDetailUpload() {
  const { session } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const candidateId = session?.candidateId ?? 'anonymous';

  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<BankDetailFormErrors>({});
  const [proofError, setProofError] = useState<FileValidationError | null>(null);
  const [idempotencyState, setIdempotencyState] = useState<BankDetailIdempotencyKeyState>(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE);

  const mutation = useMutation<CandidateBankDetailSummary, CandidateBankDetailsError, SubmitVariables>({
    mutationFn: ({ accountTitle, accountNumber, bankName, proof, idempotencyKey, accessTokenAtCallTime }) =>
      candidateBankDetailsClient.submitBankDetail({
        accessToken: accessTokenAtCallTime,
        formData: buildFormData(accountTitle, accountNumber, bankName, proof),
        idempotencyKey,
      }),
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
      setIdempotencyState(clearBankDetailIdempotencyKey());
    },
    onError: (error) => {
      // A conflict means this exact key was already consumed -- force the
      // next submit to mint a fresh key rather than replaying the same
      // doomed attempt, mirroring useDocumentUpload.ts's identical rationale.
      if (error.code === 'CONFLICT') {
        setIdempotencyState(EMPTY_BANK_DETAIL_IDEMPOTENCY_KEY_STATE);
      }
    },
  });

  const selectProof = useCallback((nextFile: File | null) => {
    setProof(nextFile);
    setProofError(validateSelectedFile(nextFile ? { name: nextFile.name, size: nextFile.size, type: nextFile.type } : null));
    mutation.reset();
  }, [mutation]);

  const submit = useCallback(() => {
    if (!session || mutation.isPending) return;

    const errors = validateBankDetailFields({ accountTitle, accountNumber, bankName });
    setFieldErrors(errors);
    const fileError = validateSelectedFile(proof ? { name: proof.name, size: proof.size, type: proof.type } : null);
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
    selectProof,
    fieldErrors,
    proofError,
    submit,
    mutation,
  };
}
