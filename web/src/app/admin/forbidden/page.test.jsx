import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import StaffForbiddenPage from "./page";

const VIEWER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "viewer" && !account.locked && !account.suspended);

async function renderForbiddenPage() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: VIEWER.email, password: MOCK_STAFF_PASSWORD });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={["/admin/forbidden"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin" element={<p>Staff dashboard stub</p>} />
              <Route path="/admin/forbidden" element={<StaffForbiddenPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("StaffForbiddenPage", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows the access-restricted state for an authenticated staff member", async () => {
    await renderForbiddenPage();
    await waitFor(() => expect(screen.getByText("Access restricted")).toBeInTheDocument());
    expect(screen.getByText("You do not have permission to view this page.")).toBeInTheDocument();
  });

  it("navigates back to the dashboard on action", async () => {
    await renderForbiddenPage();
    await waitFor(() => expect(screen.getByText("Access restricted")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    await waitFor(() => expect(screen.getByText("Staff dashboard stub")).toBeInTheDocument());
  });
});
