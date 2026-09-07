// Query key factory for the admin backup browser (MPS-903), mirroring
// adminAuditEventQueries.ts's conventions -- `locale` is part of the key so
// a language switch is a different cache entry, never a stale-locale
// overwrite.
import type { SystemBackupListPage } from '../adminSystemBackups/types';
import type { Language } from '../i18n/translations';

export const adminSystemBackupQueries = {
  list: (page: SystemBackupListPage, locale: Language) => ['adminSystemBackups', 'list', page, locale] as const,
};
