import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import CandidateDetailsPage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");
const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "finance" && !account.locked && !account.suspended);

const CANDIDATE_RESPONSE = {
  candidate: {
    id: "c1",
    full_name: "Test Candidate",
    registration_number: "DES-2026-001",
    progress_percentage: 40,
    cnic: "12345-1234567-1",
  },
  documents: [
    { id: "d1", document_type: "cv", verification_status: "uploaded", upload_date: new Date().toISOString() },
  ],
  timeline: [],
  payments: [],
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CANDIDATE_RESPONSE) }))
  );
}

async function renderAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={["/admin/candidates/c1"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <CandidateDetailsPage params={{ id: "c1" }} />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  await screen.findByText("Test Candidate");
}

describe("CandidateDetailsPage document verification (role-gated)", () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("renders Verify/Reject actions for a staff member whose role can verify documents", async () => {
    await renderAs(ADMIN);
    expect(screen.getByText("Verify")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("never renders Verify/Reject actions for a role outside the verifier set -- not just disables them", async () => {
    await renderAs(FINANCE);
    await waitFor(() => expect(screen.getByText("Test Candidate")).toBeInTheDocument());
    expect(screen.queryByText("Verify")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });
});
