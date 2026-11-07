import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateDetail, AdminCandidateError } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateProfilePhoto } from '../../../../../../shared/adminCandidates/types';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

/** Approve or reject the candidate's profile photo, then show the new state on the candidate. */
export function useProfilePhotoDecision(candidateId: string) {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<AdminCandidateProfilePhoto, AdminCandidateError, 'approved' | 'rejected'>({
    mutationFn: (decision) => adminCandidateClient.decideProfilePhoto(candidateId, decision),
    onSuccess: (profilePhoto) => {
      queryClient.setQueryData<AdminCandidateDetail>(adminCandidateQueries.detail(candidateId, language), (current) =>
        current ? { ...current, profilePhoto } : current
      );
    },
  });
}
