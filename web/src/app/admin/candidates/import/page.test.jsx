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
import { StaffShell } from "../../../components/staff-shell";
import CandidateImportPage from "./page";
import { candidateImportClient } from "../../../../lib/candidate-import-client";

vi.mock("../../../../lib/candidate-import-client", () => ({
  candidateImportClient: { importCandidates: vi.fn() },
}));

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
              <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/candidates/import" element={<CandidateImportPage />} />
              <Route
                path="/admin"
                element={
                  <StaffShell>
                    <p>Candidates dashboard stub</p>
                  </StaffShell>
                }
              />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CandidateImportPage", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("allows a staff member with manage_candidates to reach the import screen", async () => {
    const client = await signInAs(HR);
    renderAt("/admin/candidates/import", client);

    expect(await screen.findByRole("heading", { name: "Import candidates" })).toBeInTheDocument();
    expect(screen.getByText("Upload a CSV file to register multiple candidates at once.")).toBeInTheDocument();
  });

  it("redirects a staff member without manage_candidates to the forbidden route", async () => {
    const client = await signInAs(FINANCE);
    renderAt("/admin/candidates/import", client);

    await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
    expect(screen.queryByText("Upload a CSV file to register multiple candidates at once.")).not.toBeInTheDocument();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/candidates/import", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });

  it("shows the import navigation item only for staff with manage_candidates", async () => {
    const withPermission = await signInAs(HR);
    renderAt("/admin", withPermission);
    expect(await screen.findByText("Candidates dashboard stub")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import candidates" })).toBeInTheDocument();
  });

  it("never renders the import navigation item for staff lacking manage_candidates", async () => {
    const withoutPermission = await signInAs(FINANCE);
    renderAt("/admin", withoutPermission);
    expect(await screen.findByText("Candidates dashboard stub")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Import candidates" })).not.toBeInTheDocument();
  });
});
