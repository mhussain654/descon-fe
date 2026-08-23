import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../contexts/StaffAuthContext";
import AdminDashboardPage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      if (url.includes("/api/stats")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ totalCandidates: 0, documentStats: { verified: 0 }, paymentStats: { paid: 0 } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ candidates: [] }) });
    })
  );
}

function renderAdminPage(client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Sign-in stub</p>} />
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminDashboardPage (candidate-management console)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("redirects to staff sign-in instead of rendering when unauthenticated (previously had no guard at all)", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAdminPage(client);

    await waitFor(() => expect(screen.getByText("Sign-in stub")).toBeInTheDocument());
    expect(screen.queryByText("Descon Manpower")).not.toBeInTheDocument();
  });

  it("renders for an authenticated staff member", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
    renderAdminPage(client);

    await waitFor(() => expect(screen.getByText("Descon Manpower")).toBeInTheDocument());
  });
});
