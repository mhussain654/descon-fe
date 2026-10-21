import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { toast } from '../../../../design-system';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, RobocallVoice, RobocallVoiceInput } from '../../../../lib/admin-bulk-calls-client';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

interface SaveVariables {
  /** Absent when adding a new call type. */
  id?: string;
  input: Partial<RobocallVoiceInput>;
}

/** Adds a call type, or changes an existing one (a rename, a new voice id, or switching it off). Editing has no external side effect, so no Idempotency-Key. */
export function useSaveRobocallVoice() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation<RobocallVoice, AdminBulkCallError, SaveVariables>({
    mutationFn: ({ id, input }) =>
      id ? adminBulkCallsClient.updateVoice(id, input) : adminBulkCallsClient.createVoice(input as RobocallVoiceInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminBulkCallQueries.voices(language) });
      toast.success(t('adminBulkCallTypeSavedToast'));
    },
  });
}
