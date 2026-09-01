import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { paymentsClient } from "../../lib/payments-client";
import PaymentPage from "./page";

vi.mock("../../lib/payments-client", () => ({
  paymentsClient: { getEligibility: vi.fn(), initiateCheckout: vi.fn() },
}));

function LoginStub() {
  const { login } = useAuth();
  return (
    <div>
      <p>Login screen</p>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: "candidate-access-token",
            refreshToken: "refresh",
            candidateId: "candidate-public-id-1",
            candidateName: "Ahmed Ali",
            preferredLocale: "en",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        login
      </button>
      <Link to="/payment">Go to payment</Link>
    </div>
  );
}

function renderPaymentPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/payment" element={<PaymentPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("PaymentPage", () => {
  afterEach(() => {
    vi.mocked(paymentsClient.getEligibility).mockReset();
  });

  it("redirects to login instead of rendering when unauthenticated", () => {
    renderPaymentPage();

    expect(screen.getByText("Login screen")).toBeInTheDocument();
    expect(screen.queryByText("Make Payment")).not.toBeInTheDocument();
  });

  it("renders the real payment panel for an authenticated candidate", async () => {
    paymentsClient.getEligibility.mockResolvedValue({
      eligible: true,
      checkoutAvailable: true,
      requiredStageCode: "fee_pending",
      currentStageCode: "fee_pending",
      blockingReasons: [],
      amount: "1500.0",
      currencyCode: "PKR",
      latestPayment: null,
    });
    renderPaymentPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(await screen.findByText("Go to payment"));

    expect(await screen.findByRole("heading", { name: "Make Payment" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Pay now" })).toBeInTheDocument();
  });
});
