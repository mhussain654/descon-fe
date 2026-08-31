import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateDetail, AdminCandidateError } from '../../../../lib/admin-candidates-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

export interface CreateCandidateFormValues {
  fullName: string;
  cnic: string;
  mobileNumber: string;
  /** Empty string means "no passport number" -- never sent to the backend. */
  passportNumber: string;
  preferredLocale: 'en' | 'ur';
  countryCode: string;
  projectCode: string;
  craftCode: string;
  referenceNumber: string;
}

function randomIdempotencyKey(): string {
  return `admin-candidate-create-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sameValues(a: CreateCandidateFormValues | null, b: CreateCandidateFormValues): boolean {
  if (!a) return false;
  return (Object.keys(b) as (keyof CreateCandidateFormValues)[]).every((key) => a[key] === b[key]);
}

export interface UseCreateCandidateOptions {
  /** Called once the candidate is actually created (real id, never fabricated) -- the caller navigates to the new candidate's detail route. */
  onSuccess?: (candidate: AdminCandidateDetail) => void;
}

/**
 * Owns the create-candidate mutation's idempotency-key lifecycle (a fresh
 * key per distinct set of submitted values, the same key replayed for a
 * retry of the identical submission) and duplicate-submission guard,
 * mirroring the transition-idempotency pattern used across the workflow
 * feature. This is a full dedicated page, not a reusable dialog, so field
 * state itself lives in the form component, not here.
 */
export function useCreateCandidate(options: UseCreateCandidateOptions = {}) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [keyState, setKeyState] = useState<{ key: string; values: CreateCandidateFormValues } | null>(null);

  const mutation = useMutation<AdminCandidateDetail, AdminCandidateError, CreateCandidateFormValues & { idempotencyKey: string }>({
    mutationFn: (variables) =>
      adminCandidateClient.createCandidate({
        fullName: variables.fullName,
        cnic: variables.cnic,
        mobileNumber: variables.mobileNumber,
        passportNumber: variables.passportNumber || undefined,
        preferredLocale: variables.preferredLocale,
        countryCode: variables.countryCode,
        projectCode: variables.projectCode,
        craftCode: variables.craftCode,
        referenceNumber: variables.referenceNumber,
        idempotencyKey: variables.idempotencyKey,
      }),
    onSuccess: (candidate) => {
      // Primes the new candidate's own detail cache so navigating there is
      // instant, using only the real response -- never a fabricated id.
      queryClient.setQueryData(adminCandidateQueries.detail(candidate.id, language), candidate);
      toast.success(t('adminCandidateCreateSuccessToast'));
      setKeyState(null);
      options.onSuccess?.(candidate);
    },
    onError: (error) => {
      // A conflict means this exact key was already consumed -- force the
      // next submit to mint a fresh one rather than silently replaying a
      // doomed attempt. Every other error (validation/duplicate/rate-limit/
      // network/offline/server/in-progress) keeps the same key so a manual
      // retry of the unchanged form replays safely.
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        setKeyState(null);
      }
    },
  });

  const submit = useCallback(
    (values: CreateCandidateFormValues) => {
      if (mutation.isPending) return;

      const key = sameValues(keyState?.values ?? null, values)
        ? (keyState as { key: string; values: CreateCandidateFormValues }).key
        : randomIdempotencyKey();
      setKeyState({ key, values });
      mutation.mutate({ ...values, idempotencyKey: key });
    },
    [mutation, keyState]
  );

  return { submit, mutation };
}
