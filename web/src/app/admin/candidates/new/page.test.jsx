import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminCandidateClient } from "../../../../lib/admin-candidates-client";
import NewCandidatePage from "./page";

vi.mock("../../../../lib/admin-candidates-client", () => ({
  adminCandidateClient: {
    getCandidate: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidate: vi.fn(),
    getCountries: vi.fn(),
    getProjects: vi.fn(),
    getCrafts: vi.fn(),
  },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "hr");
const MPS = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "mps");

async function renderAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={["/admin/candidates/new"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <NewCandidatePage />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("NewCandidatePage", () => {
  afterEach(() => {
    vi.mocked(adminCandidateClient.getCountries).mockReset();
    vi.mocked(adminCandidateClient.getProjects).mockReset();
    vi.mocked(adminCandidateClient.getCrafts).mockReset();
    sessionStorage.clear();
  });

  it("renders the real creation form for a staff member with manage_candidates", async () => {
    adminCandidateClient.getCountries.mockResolvedValue([]);
    adminCandidateClient.getProjects.mockResolvedValue([]);
    adminCandidateClient.getCrafts.mockResolvedValue([]);

    await renderAs(HR);

    expect(await screen.findByText("Add candidate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create candidate" })).toBeInTheDocument();
  });

  it("never renders the creation form for a staff member without manage_candidates -- role alone never grants access", async () => {
    await renderAs(MPS);

    expect(screen.queryByText("Add candidate")).not.toBeInTheDocument();
  });
});
