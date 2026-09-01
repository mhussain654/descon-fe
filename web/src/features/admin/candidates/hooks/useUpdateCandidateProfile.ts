import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateDetail, AdminCandidateError } from '../../../../lib/admin-candidates-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';
import type { NextOfKinInput } from '../../../../../../shared/adminCandidates/types';

export interface UpdateCandidateFormValues {
  fullName?: string;
  mobileNumber?: string;
  passportNumber?: string;
  nextOfKin?: NextOfKinInput;
  preferredLocale?: 'en' | 'ur';
  countryCode?: string;
  projectCode?: string;
  craftCode?: string;
}

/**
 * Owns the profile-update mutation. The caller (the profile card's edit
 * form) is responsible for sending only the fields it actually changed --
 * this hook does not diff against the loaded detail itself, since the form
 * already knows precisely what the staff member touched.
 *
 * A stale conflict (`expectedUpdatedAt` no longer matching -- ticket: "For
 * stale/conflicting updates, do not silently resubmit... refresh candidate
 * detail") refreshes the detail query and surfaces a notice instead of
 * retrying; every other failure (validation, duplicate passport, a locked
 * assignment field) is rendered inline by the caller from `mutation.error`,
 * with the form's own field values preserved exactly as the staff member
 * left them (ticket: "Preserve server values when a partial update fails" --
 * satisfied simply by never touching the cached detail on failure).
 */
export function useUpdateCandidateProfile(candidateId: string | undefined) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [staleNotice, setStaleNotice] = useState(false);

  const invalidateDetail = useCallback(() => {
    if (!candidateId) return;
    queryClient.invalidateQueries({ queryKey: adminCandidateQueries.detail(candidateId, language) });
  }, [queryClient, candidateId, language]);

  const mutation = useMutation<
    AdminCandidateDetail,
    AdminCandidateError,
    UpdateCandidateFormValues & { expectedUpdatedAt: string | undefined }
  >({
    mutationFn: (variables) =>
      adminCandidateClient.updateCandidate({
        candidateId: candidateId as string,
        ...variables,
      }),
    onSuccess: (candidate) => {
      queryClient.setQueryData(adminCandidateQueries.detail(candidate.id, language), candidate);
      toast.success(t('adminCandidateUpdateSuccessToast'));
      setStaleNotice(false);
    },
    onError: (error) => {
      if (error.code === 'STALE_CANDIDATE') {
        setStaleNotice(true);
        invalidateDetail();
      }
      // VALIDATION_ERROR/DUPLICATE_PASSPORT_NUMBER/ASSIGNMENT_FIELD_LOCKED/
      // RATE_LIMITED/NETWORK_ERROR/OFFLINE/SERVER_ERROR: the caller keeps the
      // form open and renders error.field/message inline; no auto-retry.
    },
  });

  const submit = useCallback(
    (values: UpdateCandidateFormValues, expectedUpdatedAt: string | undefined) => {
      if (!candidateId || mutation.isPending) return;
      mutation.mutate({ ...values, expectedUpdatedAt });
    },
    [candidateId, mutation]
  );

  const dismissStaleNotice = useCallback(() => setStaleNotice(false), []);

  // The explicit action behind the stale notice's "Refresh" button -- the
  // detail query is already invalidated automatically in onError above, but
  // ticket: "handle stale/conflicting updates safely... by showing a clear
  // refresh/reload action" wants a visible, deliberate control, not just a
  // silent background refetch the staff member has no way to trigger again.
  const refresh = useCallback(() => {
    setStaleNotice(false);
    if (!candidateId) return;
    queryClient.refetchQueries({ queryKey: adminCandidateQueries.detail(candidateId, language) });
  }, [queryClient, candidateId, language]);

  return { submit, mutation, staleNotice, dismissStaleNotice, refresh };
}
