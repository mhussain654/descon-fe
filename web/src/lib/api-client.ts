// Web configuration for the shared API client foundation (../../../shared/api-client.ts).
// Request behavior, error normalization and the Rails ErrorEnvelope contract
// live in that shared module; this file only supplies the web-specific base
// URL convention and re-exports the portable types.

import { createApiClient } from '../../../shared/api-client';

export type {
  ApiClient,
  ApiClientConfig,
  ApiError,
  ApiErrorCode,
  ApiErrorItem,
  RequestOptions,
} from '../../../shared/api-client';

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (!baseUrl && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api-client] VITE_API_BASE_URL is not set. Copy web/.env.example to web/.env and set it before using apiClient.'
  );
}

export const apiClient = createApiClient({ baseUrl: baseUrl ?? '' });
