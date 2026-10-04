import { createApiClient } from "../api-client";
import type { StaffAuthClient } from "../auth/staffTypes";
import { createAdminFeesClient } from "./realAdminFeesClient";
import { validFeeAmount } from "./types";
const payload = {
  default_amount: "26800.00",
  override_amount: "25000.00",
  effective_amount: "25000.00",
  currency_code: "PKR",
  version: 2,
  assignment_id: "assignment-1",
  locked: false,
  updated_at: "2026-10-04T09:00:00Z",
};
const auth: StaffAuthClient = {
  signIn: async () => {
    throw new Error("unused");
  },
  restoreSession: async () => null,
  signOut: async () => undefined,
  authenticatedRequest: async () => {
    throw new Error("unused");
  },
  authenticatedDataRequest: async (request) => request("test-token"),
};
const client = createAdminFeesClient({
  apiClient: createApiClient({ baseUrl: "https://example.test/api/v1" }),
  staffAuthClient: auth,
  getLocale: () => "ur",
});
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
function captureFetch(response: Response) {
  const calls: [string, RequestInit | undefined][] = [];
  globalThis.fetch = async (input, init) => {
    calls.push([String(input), init]);
    return response;
  };
  return calls;
}
describe("admin fees API", () => {
  it("fetches and maps the authorized candidate fee", async () => {
    const calls = captureFetch(
      new Response(JSON.stringify({ data: payload, meta: {}, errors: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await client.getFee("candidate/1")).toMatchObject({
      defaultAmount: "26800.00",
      overrideAmount: "25000.00",
      version: 2,
    });
    expect(calls[0][0]).toBe(
      "https://example.test/api/v1/admin/candidates/candidate%2F1/fee",
    );
    expect(calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "X-Locale": "ur",
    });
  });
  it("sends null to remove an override with a version and reason", async () => {
    const calls = captureFetch(
      new Response(JSON.stringify({ data: payload }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await client.updateFee(
      { amount: null, expectedVersion: 2, reason: "  Use standard fee  " },
      "candidate-1",
    );
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
      fee: { amount: null, expected_version: 2, reason: "Use standard fee" },
    });
    expect(calls[0][1]?.method).toBe("PATCH");
  });
  it.each([
    ["stale_fee", "STALE_FEE"],
    ["fee_locked", "FEE_LOCKED"],
  ])("preserves %s conflict", async (code, mapped) => {
    captureFetch(
      new Response(JSON.stringify({ errors: [{ code, message: "Reload" }] }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(
      client.updateFee({
        amount: "26800",
        expectedVersion: 0,
        reason: "Default update",
      }),
    ).rejects.toMatchObject({ code: mapped });
  });
  it.each(["0", "-1", "1.001", "1e3", "100000000", "", "1,000"])(
    "rejects invalid fee %s",
    (value) => expect(validFeeAmount(value)).toBe(false),
  );
  it.each(["26800", "1.01", "99999999.99"])(
    "accepts exact decimal fee %s",
    (value) => expect(validFeeAmount(value)).toBe(true),
  );
});
