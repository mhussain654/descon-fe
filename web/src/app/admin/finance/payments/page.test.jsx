import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import AdminFinancePaymentsPage from "./page";
import { adminPaymentsClient } from "../../../../lib/admin-payments-client";

vi.mock("../../../../lib/admin-payments-client", () => ({
  adminPaymentsClient: {
    listPayments: vi.fn(),
    getPayment: vi.fn(),
    correctPayment: vi.fn(),
  },
}));

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance" && !account.locked && !account.suspended);
const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr");

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
              <Route path="/admin/finance/payments" element={<AdminFinancePaymentsPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminFinancePaymentsPage", () => {
  afterEach(() => {
    vi.mocked(adminPaymentsClient.listPayments).mockReset();
    sessionStorage.clear();
  });

  it("allows a finance staff member (manage_payments) to reach the payments workspace", async () => {
    adminPaymentsClient.listPayments.mockResolvedValue({ items: [], pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 }, appliedFilters: {} });
    const client = await signInAs(FINANCE);
    renderAt("/admin/finance/payments", client);

    expect(await screen.findByText("Payment transactions")).toBeInTheDocument();
  });

  it("shows the workspace's own forbidden state for a staff member lacking view_payments/manage_payments -- no route guard", async () => {
    adminPaymentsClient.listPayments.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);
    renderAt("/admin/finance/payments", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/finance/payments", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
