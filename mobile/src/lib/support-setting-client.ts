// Mobile configuration for the candidate support-number client (mirrors
// mobile/src/lib/training-setting-client.ts exactly). Wires the real backend
// (shared/supportSetting/realSupportSettingClient.ts).
import { createSupportSettingClient } from '../../../shared/supportSetting/realSupportSettingClient';
import type { SupportSetting, SupportSettingClient, SupportSettingError, SupportSettingErrorCode } from '../../../shared/supportSetting/types';
import { getCachedLanguage } from '../contexts/LanguageContext';
import { apiClient } from './api-client';

export type { SupportSetting, SupportSettingClient, SupportSettingError, SupportSettingErrorCode };

export const supportSettingClient: SupportSettingClient = createSupportSettingClient({
  apiClient,
  // getCachedLanguage is exported from a plain .jsx file, so TS widens its
  // return type to `string` -- see mobile/src/lib/auth-client.ts's identical comment.
  getLocale: () => getCachedLanguage() as 'en' | 'ur',
});
