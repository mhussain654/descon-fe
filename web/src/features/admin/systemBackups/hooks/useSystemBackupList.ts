import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminSystemBackupsClient } from '../../../../lib/admin-system-backups-client';
import type { SystemBackupListPage } from '../../../../lib/admin-system-backups-client';
import { adminSystemBackupQueries } from '../../../../../../shared/queryKeys/adminSystemBackupQueries';

/** The backup list, paginated -- mirrors useAuditEventList.ts's identical pattern. */
export function useSystemBackupList(page: SystemBackupListPage) {
  const { language } = useLanguage();

  return useQuery({
    queryKey: adminSystemBackupQueries.list(page, language),
    queryFn: () => adminSystemBackupsClient.listBackups(page),
    placeholderData: keepPreviousData,
  });
}
