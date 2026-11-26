// Query keys for developer-only reference data management.
import type { Language } from '../i18n/translations';
import type { LookupKind } from '../adminReferenceData/types';

export const adminReferenceDataQueries = {
  all: ['adminReferenceData'] as const,
  lookups: (kind: LookupKind, locale: Language) => ['adminReferenceData', 'lookups', kind, locale] as const,
  rolePermissions: (locale: Language) => ['adminReferenceData', 'rolePermissions', locale] as const,
  checklist: (locale: Language) => ['adminReferenceData', 'checklist', locale] as const,
  workflowStages: (locale: Language) => ['adminReferenceData', 'workflowStages', locale] as const,
  mobilizationProcesses: (locale: Language) => ['adminReferenceData', 'mobilizationProcesses', locale] as const,
};
