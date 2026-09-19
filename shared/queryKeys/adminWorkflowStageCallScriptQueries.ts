// Query key factory for the admin workflow-stage call scripts list
// (MPS-F706) -- `locale` is part of the key so a language switch is a
// different cache entry, never a stale-locale overwrite.
import type { Language } from '../i18n/translations';

export const adminWorkflowStageCallScriptQueries = {
  list: (locale: Language) => ['adminWorkflowStageCallScripts', 'list', locale] as const,
};
