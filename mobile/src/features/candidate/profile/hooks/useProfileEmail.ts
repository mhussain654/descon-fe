import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../contexts/AuthContext';
import { candidateProfileClient } from '../../../../lib/candidate-profile-client';
import { isAcceptableEmail, normalizeEmail } from '../../../../../../shared/candidateProfile/email';
import type { ProfileEmailError } from '../../../../../../shared/candidateProfile/types';

export type ProfileEmailProblem = { kind: 'invalid' } | { kind: 'failed'; error: ProfileEmailError };

/**
 * Saves the signed-in candidate's own email address (an empty one clears it),
 * then refreshes the profile so Profile and Home both see it. Checks the
 * format first for a fast, clear message; the backend re-checks it.
 */
export function useProfileEmail(onSaved: () => void) {
  const { session, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<ProfileEmailProblem | null>(null);
  const candidateId = (session as { candidateId: string } | null)?.candidateId ?? 'anonymous';

  const mutation = useMutation({
    mutationFn: async (email: string) => candidateProfileClient.updateEmail({ accessToken: await getAccessToken(), email }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', 'candidate', candidateId] });
      onSaved();
    },
    onError: (error: ProfileEmailError) => setProblem({ kind: 'failed', error }),
  });

  const save = useCallback(
    (value: string) => {
      if (!isAcceptableEmail(value)) return setProblem({ kind: 'invalid' });
      setProblem(null);
      mutation.mutate(normalizeEmail(value));
    },
    [mutation]
  );

  return { save, isSaving: mutation.isPending, problem, clearProblem: () => setProblem(null) };
}
