// Mobile configuration for the shared API client foundation (../../../shared/api-client.ts).
// Request behavior, error normalization and the Rails ErrorEnvelope contract
// live in that shared module; this file only supplies the mobile-specific
// base URL convention and re-exports the portable types.

import { createApiClient } from '../../../shared/api-client';

export type {
  ApiClient,
  ApiClientConfig,
  ApiError,
  ApiErrorCode,
  ApiErrorItem,
  RequestOptions,
} from '../../../shared/api-client';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!baseUrl && __DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    "[api-client] EXPO_PUBLIC_API_BASE_URL is not set. Copy mobile/.env.example to mobile/.env, set it to your development machine's LAN IP, and restart Expo before using apiClient."
  );
}

export const apiClient = createApiClient({ baseUrl: baseUrl ?? '' });
