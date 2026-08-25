// Portable API client foundation shared by web and mobile.
//
// Platform entry points (web/src/lib/api-client.ts, mobile/src/lib/api-client.ts)
// only supply platform configuration (base URL from the platform's env
// convention, a dev-only missing-config warning) and re-export this module's
// types. All request behavior, error normalization and the Rails
// ErrorEnvelope contract live here exactly once.

/**
 * Stable, platform-agnostic failure buckets. UI code localizes user-facing
 * copy from `code` (and `serverCode`, when the backend supplied one) --
 * never from `message`, which is either the raw server-provided text (in
 * whatever locale the server chose) or absent entirely for infrastructure
 * failures. Do not add new hardcoded English strings here; add a code.
 */
export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/** One entry from the Rails ErrorEnvelope's `errors` array. */
export interface ApiErrorItem {
  code: string;
  message: string;
  field?: string;
}

export interface ApiError {
  code: ApiErrorCode;
  /** HTTP status, or 0 for network/offline/timeout/cancelled failures. */
  status: number;
  /**
   * Raw message from the server (already localized server-side per
   * Accept-Language), present only for HTTP error responses that returned
   * one. For infrastructure failures (network/offline/timeout/cancelled/
   * parse/unknown) this is intentionally absent -- localize from `code`
   * instead of inventing English copy here.
   */
  message?: string;
  /** The backend's own domain error code (e.g. "invalid_credentials"), when the response body was a Rails ErrorEnvelope. Prefer this over `code` for precise, localizable UI copy. */
  serverCode?: string;
  /** The field the first envelope error applies to, for form-level mapping. */
  field?: string;
  /** Every error item from the envelope, for forms that must surface more than one field error. */
  errors?: ApiErrorItem[];
  /** Rails request id, for support/debugging correlation. */
  requestId?: string;
  /** Seconds to wait before retrying, parsed from a `Retry-After` response header (seconds form) when present -- set on rate-limited (429) responses. */
  retryAfterSeconds?: number;
  /** Raw server payload or original error, for logging only -- never render directly. */
  details?: unknown;
}

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  /** Default request timeout in ms. */
  timeoutMs?: number;
  /** Returns whether the device currently has connectivity, when known. Defaults to `navigator.onLine` where available. */
  isOnline?: () => boolean;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  /** Caller-owned cancellation, e.g. tied to component unmount or a stale request. Distinguished from our own timeout in the resulting ApiError. */
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

function defaultIsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

interface ErrorEnvelope {
  errors: ApiErrorItem[];
  request_id?: string;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as { errors?: unknown }).errors) &&
    (value as { errors: unknown[] }).errors.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as { code?: unknown }).code === 'string' &&
        typeof (item as { message?: unknown }).message === 'string'
    )
  );
}

async function toResponseError(response: Response): Promise<ApiError> {
  const code: ApiErrorCode = response.status >= 500 ? 'HTTP_5XX' : 'HTTP_4XX';
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    // Body wasn't JSON (or was empty) -- fall through with no envelope data.
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds =
    retryAfterHeader && !Number.isNaN(Number(retryAfterHeader)) ? Number(retryAfterHeader) : undefined;

  if (isErrorEnvelope(body)) {
    const [first] = body.errors;
    return {
      status: response.status,
      code,
      message: first?.message,
      serverCode: first?.code,
      field: first?.field,
      errors: body.errors,
      requestId: body.request_id,
      retryAfterSeconds,
      details: body,
    };
  }

  return { status: response.status, code, retryAfterSeconds, details: body };
}

async function parseJsonBody<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const parseError: ApiError = { status: response.status, code: 'PARSE_ERROR', details: error };
    throw parseError;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const {
    baseUrl,
    defaultHeaders = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    isOnline = defaultIsOnline,
  } = config;

  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    opts: RequestOptions = {}
  ): Promise<T | undefined> {
    const controller = new AbortController();
    const timeout = opts.timeoutMs ?? timeoutMs;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);

    const callerSignal = opts.signal;
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

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
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) {
          throw { status: 0, code: 'TIMEOUT' } satisfies ApiError;
        }
        if (callerSignal?.aborted) {
          throw { status: 0, code: 'CANCELLED' } satisfies ApiError;
        }
        throw { status: 0, code: 'TIMEOUT' } satisfies ApiError;
      }
      throw {
        status: 0,
        code: isOnline() ? 'NETWORK_ERROR' : 'OFFLINE',
        details: error,
      } satisfies ApiError;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
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
      throw { status: response.status, code: 'UNKNOWN', details: error } satisfies ApiError;
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

export type ApiClient = ReturnType<typeof createApiClient>;
