import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import type { BulkCallBatch, BulkCallCandidatesResult, RobocallVoice } from "../../../../lib/admin-bulk-calls-client";

export const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin")!;
export const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance")!;

/** Signs in a mock staff account; `extraPermissions` adds permissions the mock account does not carry (the real backend grants them per role). */
export async function signInAs(account: { email: string }, extraPermissions: string[] = []) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  const session = await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  if (extraPermissions.length) {
    client.restoreSession = async () => ({ ...session, permissions: [...session.permissions, ...extraPermissions] });
  }
  return client;
}

export const MANAGE_CALL_TYPES = ["manage_ai_call_scripts"];

/** Renders `ui` the way the admin shell would: language, staff session, query cache and a router (the page links to batch results). */
export function renderWithStaff(client: Awaited<ReturnType<typeof signInAs>>, ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>{ui}</StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

export function voice(overrides: Partial<RobocallVoice> = {}): RobocallVoice {
  return { id: "voice-1", nameEn: "Visa approved", nameUr: undefined, voiceId: "205", active: true, updatedAt: "2026-10-18T09:00:00Z", ...overrides };
}

export function candidatesResult(overrides: Partial<BulkCallCandidatesResult> = {}): BulkCallCandidatesResult {
  return {
    candidates: [
      { id: "c1", fullName: "Ahmed Khan", referenceNumber: "DES-1", mobileNumberMasked: "+92300*****12", callState: "not_called" },
      {
        id: "c2",
        fullName: "Bilal Raza",
        referenceNumber: undefined,
        mobileNumberMasked: "+92301*****34",
        callState: "called",
        lastCall: { status: "completed", outcome: "answered", outcomeReason: "resolved", calledAt: "2026-10-18T08:00:00Z" },
      },
    ],
    pagination: { page: 1, perPage: 25, totalCount: 2, totalPages: 1 },
    summary: { matching: 340, called: 140, remaining: 200 },
    batchLimit: 200,
    ...overrides,
  };
}

export function batch(overrides: Partial<BulkCallBatch> = {}): BulkCallBatch {
  return {
    id: "batch-1",
    voice: { id: "voice-1", name: "Visa approved" },
    workflowStageCode: "verified",
    filters: {},
    requestedLimit: 200,
    selectedCount: 200,
    counts: { queued: 150, placed: 40, skipped: 7, failed: 3 },
    createdBy: { id: "staff-1", role: "admin" },
    createdAt: "2026-10-18T09:00:00Z",
    ...overrides,
  };
}
