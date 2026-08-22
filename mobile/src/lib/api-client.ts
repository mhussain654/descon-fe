// Centralized API client foundation for talking to the Rails API.
//
// This is intentionally not wired into any screen yet -- login, OTP,
// candidate, document, and payment data all still come from the existing
// mock flows. This module exists so the next ticket that wires real API
// calls has a single, consistent place to do it from, with a normalized
// error shape shared (by contract, not by code -- web has its own
// independent copy) with the web app.

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

export interface ApiError {
  /** Human-readable, safe to show in UI. */
  message: string;
  /** HTTP status, or 0 for network/offline/timeout failures. */
  status: number;
  code: ApiErrorCode;
  /** Raw server payload or original error, for debugging/logging only. */
  details?: unknown;
}

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  /** Default request timeout in ms. */
  timeoutMs?: number;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

function toApiError(error: unknown): ApiError {
  if (error instanceof Error && error.name === 'AbortError') {
    return { status: 0, code: 'TIMEOUT', message: 'Request timed out' };
  }
  return {
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'Network request failed',
    details: error,
  };
}

async function toResponseError(response: Response): Promise<ApiError> {
  const code: ApiErrorCode = response.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX';
  let message = response.statusText || `Request failed with status ${response.status}`;
  let details: unknown;
  try {
    details = await response.clone().json();
    if (details && typeof details === 'object' && 'message' in details) {
      const candidate = (details as { message?: unknown }).message;
      if (typeof candidate === 'string' && candidate.length > 0) {
        message = candidate;
      }
    }
  } catch {
    // Body wasn't JSON (or was empty) -- fall back to statusText above.
  }
  return { status: response.status, code, message, details };
}

async function parseJsonBody<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const parseError: ApiError = {
      status: response.status,
      code: 'PARSE_ERROR',
      message: 'Failed to parse server response',
      details: error,
    };
    throw parseError;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, defaultHeaders = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = config;

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    opts: RequestOptions = {}
  ): Promise<T | undefined> {
    const controller = new AbortController();
    const timeout = opts.timeoutMs ?? timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);
    if (opts.signal) {
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...defaultHeaders,
          ...opts.headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      throw toApiError(error);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw await toResponseError(response);
    }

    try {
      return await parseJsonBody<T>(response);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error as ApiError;
      }
      throw { status: response.status, code: 'UNKNOWN', message: 'Unexpected error', details: error } satisfies ApiError;
    }
  }

  return {
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, body, opts),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PUT', path, body, opts),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, body, opts),
    del: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, undefined, opts),
  };
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!baseUrl && __DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    '[api-client] EXPO_PUBLIC_API_BASE_URL is not set. Copy mobile/.env.example to mobile/.env, set it to your development machine\'s LAN IP, and restart Expo before using apiClient.'
  );
}

export const apiClient = createApiClient({ baseUrl: baseUrl ?? '' });
