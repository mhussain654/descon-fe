import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import AdminProfilePage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

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
              <Route path="/admin/profile" element={<AdminProfilePage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminProfilePage", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows any signed-in staff member's own account summary -- no extra permission required", async () => {
    const client = await signInAs(ADMIN);
    renderAt("/admin/profile", client);

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getAllByText(ADMIN.email).length).toBeGreaterThan(0);
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/profile", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
