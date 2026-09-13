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
import AdminCommunicationsPage from "./page";
import { adminCommunicationsClient } from "../../../lib/admin-communications-client";

vi.mock("../../../lib/admin-communications-client", () => ({
  adminCommunicationsClient: {
    listCommunications: vi.fn(),
  },
}));

// `hr`'s mock account carries manage_communications; `finance` carries
// neither view_communications nor manage_communications (see
// shared/auth/staffAuthClient.ts) -- exactly the kind of gating test
// AdminAuditLogPage's own test uses HR for.
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr" && !account.locked && !account.suspended);
const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance");

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
              <Route path="/admin/communications" element={<AdminCommunicationsPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminCommunicationsPage", () => {
  afterEach(() => {
    vi.mocked(adminCommunicationsClient.listCommunications).mockReset();
    sessionStorage.clear();
  });

  it("allows a staff member with manage_communications to reach the communications log", async () => {
    adminCommunicationsClient.listCommunications.mockResolvedValue({
      items: [],
      pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 },
      appliedFilters: {},
    });
    const client = await signInAs(HR);
    renderAt("/admin/communications", client);

    expect(await screen.findByRole("heading", { name: "Communications" })).toBeInTheDocument();
  });

  it("shows the communications log's own forbidden state for a staff member lacking view_communications/manage_communications -- no route guard", async () => {
    adminCommunicationsClient.listCommunications.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(FINANCE);
    renderAt("/admin/communications", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/communications", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
