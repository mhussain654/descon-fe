import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import AdminAuditLogPage from "./page";
import { adminAuditEventsClient } from "../../../lib/admin-audit-events-client";

vi.mock("../../../lib/admin-audit-events-client", () => ({
  adminAuditEventsClient: {
    listAuditEvents: vi.fn(),
  },
}));

// Only `management`'s mock account carries view_audit_events (see
// shared/auth/staffAuthClient.ts) -- `admin`'s mock is deliberately scoped
// to a narrow permission set for exactly this kind of gating test.
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "management");
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended);

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderAt(path, client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminAuditLogPage", () => {
  afterEach(() => {
    vi.mocked(adminAuditEventsClient.listAuditEvents).mockReset();
    sessionStorage.clear();
  });

  it("allows a management staff member (view_audit_events) to reach the audit log", async () => {
    adminAuditEventsClient.listAuditEvents.mockResolvedValue({
      items: [],
      pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 },
      appliedFilters: {},
    });
    const client = await signInAs(MANAGEMENT);
    renderAt("/admin/audit-log", client);

    expect(await screen.findByRole("heading", { name: "Audit log" })).toBeInTheDocument();
  });

  it("shows the audit log's own forbidden state for a staff member lacking view_audit_events -- no route guard", async () => {
    adminAuditEventsClient.listAuditEvents.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);
    renderAt("/admin/audit-log", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/audit-log", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
