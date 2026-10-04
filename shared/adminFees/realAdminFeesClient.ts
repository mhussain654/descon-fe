import type { ApiClient, ApiError } from "../api-client";
import type { StaffAuthClient } from "../auth/staffTypes";
import type { AdminFee, AdminFeeError, AdminFeesClient } from "./types";
interface FeeResponse {
  default_amount: string;
  override_amount: string | null;
  effective_amount: string;
  currency_code: string;
  version: number;
  assignment_id: string | null;
  locked: boolean;
  updated_at: string;
}
function mapFee(data: FeeResponse): AdminFee {
  return {
    defaultAmount: data.default_amount,
    overrideAmount: data.override_amount,
    effectiveAmount: data.effective_amount,
    currencyCode: data.currency_code,
    version: data.version,
    assignmentId: data.assignment_id,
    locked: data.locked,
    updatedAt: data.updated_at,
  };
}
function mapError(error: unknown): AdminFeeError {
  if (!error || typeof error !== "object" || !("code" in error))
    return { code: "UNKNOWN" };
  if (error.code === "SESSION_EXPIRED") return { code: "SESSION_EXPIRED" };
  if (error.code === "OFFLINE") return { code: "OFFLINE" };
  if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
    return { code: "NETWORK_ERROR" };
  const e = error as ApiError;
  if (e.status === 403)
    return {
      code:
        e.serverCode === "inactive_account" ? "INACTIVE_ACCOUNT" : "FORBIDDEN",
      message: e.message,
    };
  if (e.status === 404) return { code: "NOT_FOUND", message: e.message };
  if (e.status === 409)
    return {
      code: e.serverCode === "fee_locked" ? "FEE_LOCKED" : "STALE_FEE",
      message: e.message,
    };
  if (e.status === 400 || e.status === 422)
    return { code: "VALIDATION_FAILED", message: e.message, field: e.field };
  if (e.status >= 500) return { code: "SERVER_ERROR" };
  return { code: "UNKNOWN" };
}
export function createAdminFeesClient({
  apiClient,
  staffAuthClient,
  getLocale,
}: {
  apiClient: ApiClient;
  staffAuthClient: StaffAuthClient;
  getLocale: () => "en" | "ur";
}): AdminFeesClient {
  const path = (id?: string) =>
    id
      ? `/admin/candidates/${encodeURIComponent(id)}/fee`
      : "/admin/onboarding_fee_setting";
  async function request(
    call: (token: string) => Promise<FeeResponse | undefined>,
  ): Promise<AdminFee> {
    try {
      const data = await staffAuthClient.authenticatedDataRequest(call);
      if (!data) throw { code: "UNKNOWN" };
      return mapFee(data);
    } catch (error) {
      throw mapError(error);
    }
  }
  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "X-Locale": getLocale(),
  });
  return {
    getFee: (id) =>
      request((token) =>
        apiClient.get<FeeResponse>(path(id), { headers: headers(token) }),
      ),
    updateFee: (input, id) =>
      request((token) =>
        apiClient.patch<FeeResponse>(
          path(id),
          {
            fee: {
              amount: input.amount,
              expected_version: input.expectedVersion,
              reason: input.reason.trim(),
            },
          },
          { headers: headers(token) },
        ),
      ),
  };
}
