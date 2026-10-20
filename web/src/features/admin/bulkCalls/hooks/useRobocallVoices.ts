import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminBulkCallsClient } from '../../../../lib/admin-bulk-calls-client';
import type { AdminBulkCallError, RobocallVoice } from '../../../../lib/admin-bulk-calls-client';
import { adminBulkCallQueries } from '../../../../../../shared/queryKeys/adminBulkCallQueries';

/** The call types (named RoboCall voices) -- a small list, so unpaginated. */
export function useRobocallVoices() {
  const { language } = useLanguage();

  return useQuery<RobocallVoice[], AdminBulkCallError>({
    queryKey: adminBulkCallQueries.voices(language),
    queryFn: () => adminBulkCallsClient.listVoices(),
  });
}
