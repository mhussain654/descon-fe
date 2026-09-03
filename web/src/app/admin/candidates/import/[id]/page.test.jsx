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
import CandidateImportDetailPage from "./page";
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

function batchPayload(overrides = {}) {
  return {
    id: "import-1",
    status: "completed",
    sourceFilename: "candidates.csv",
    templateVersion: "v1",
    totalRows: 2,
    acceptedRows: 2,
    rejectedRows: 0,
    skippedRows: 0,
    committedRows: 2,
    importedRows: 2,
    errorCode: null,
    expiresAt: null,
    processedAt: "2026-08-26T09:35:00Z",
    failedAt: null,
    enqueuedAt: "2026-08-26T09:30:05Z",
    createdAt: "2026-08-26T09:30:00Z",
    rowResults: [],
    ...overrides,
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
              <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/candidates/import/:id" element={<CandidateImportDetailPage params={{ id: "import-1" }} />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CandidateImportDetailPage", () => {
  afterEach(() => {
    vi.mocked(candidateImportClient.getImportBatch).mockReset();
    sessionStorage.clear();
  });

  it("allows a staff member with manage_candidates to reach the import detail screen", async () => {
    candidateImportClient.getImportBatch.mockResolvedValue(batchPayload());
    const client = await signInAs(HR);
    renderAt("/admin/candidates/import/import-1", client);

    expect(await screen.findByText("Import details")).toBeInTheDocument();
    expect(candidateImportClient.getImportBatch).toHaveBeenCalledWith("import-1");
  });

  it("redirects a staff member without manage_candidates to the forbidden route", async () => {
    const client = await signInAs(FINANCE);
    renderAt("/admin/candidates/import/import-1", client);

    await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
    expect(candidateImportClient.getImportBatch).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin/candidates/import/import-1", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
