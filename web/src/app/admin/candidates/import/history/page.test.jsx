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
import CandidateImportHistoryPage from "./page";
import { candidateImportClient } from "../../../../../lib/candidate-import-client";

vi.mock("../../../../../lib/candidate-import-client", () => ({
  candidateImportClient: {
    downloadTemplate: vi.fn(),
    preflightImport: vi.fn(),
    commitImport: vi.fn(),
    getImportBatch: vi.fn(),
    listImportHistory: vi.fn(),
    retryImport: vi.fn(),
    downloadErrorExport: vi.fn(),
  },
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
              <Route path="/admin/candidates/import/history" element={<CandidateImportHistoryPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CandidateImportHistoryPage", () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.listImportHistory).mockReset();
    sessionStorage.clear();
  });

  it("allows a staff member with manage_candidates to reach the import history screen", async () => {
    candidateImportClient.listImportHistory.mockResolvedValue({
      items: [],
      pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 },
      appliedFilters: {},
    });
    const client = await signInAs(HR);
    renderAt("/admin/candidates/import/history", client);

    expect(await screen.findByText("Import history")).toBeInTheDocument();
  });

  it("redirects a staff member without manage_candidates to the forbidden route", async () => {
    const client = await signInAs(FINANCE);
    renderAt("/admin/candidates/import/history", client);

    await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
    expect(candidateImportClient.listImportHistory).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/candidates/import/history", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
