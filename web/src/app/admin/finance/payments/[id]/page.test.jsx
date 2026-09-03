import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../../contexts/StaffAuthContext";
import AdminFinancePaymentDetailPage from "./page";
import { adminPaymentsClient } from "../../../../../lib/admin-payments-client";

vi.mock("../../../../../lib/admin-payments-client", () => ({
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

function paymentDetail() {
  return {
    id: "payment-1",
    candidate: { id: "candidate-1", fullName: "Ahmed Ali", maskedCnic: "42101-*******-1", referenceNumber: "DES-001001" },
    paymentTypeCode: "onboarding_fee",
    status: "paid",
    amount: "1500.00",
    currencyCode: "PKR",
    provider: "kuickpay",
    externalReference: "KP-1",
    reconciliationState: "clean",
    paidAt: "2026-09-01T10:05:00Z",
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:05:00Z",
    paymentEvents: [],
    reconciliationFindings: [],
  };
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
              <Route path="/admin/finance/payments/:id" element={<AdminFinancePaymentDetailPage params={{ id: "payment-1" }} />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminFinancePaymentDetailPage", () => {
  afterEach(() => {
    vi.mocked(adminPaymentsClient.getPayment).mockReset();
    sessionStorage.clear();
  });

  it("allows a finance staff member (manage_payments) to reach the payment detail", async () => {
    adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
    const client = await signInAs(FINANCE);
    renderAt("/admin/finance/payments/payment-1", client);

    expect(await screen.findByText("Payment details")).toBeInTheDocument();
    expect(adminPaymentsClient.getPayment).toHaveBeenCalledWith("payment-1");
  });

  it("shows the detail's own forbidden state for a staff member lacking view_payments/manage_payments -- no route guard", async () => {
    adminPaymentsClient.getPayment.mockRejectedValue({ code: "FORBIDDEN" });
    const client = await signInAs(HR);
    renderAt("/admin/finance/payments/payment-1", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/finance/payments/payment-1", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
