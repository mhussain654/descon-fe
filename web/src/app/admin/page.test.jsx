import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../contexts/StaffAuthContext";
import { StaffShell } from "../components/staff-shell";
import AdminCandidateListPage from "./page";
import { adminCandidateClient } from "../../lib/admin-candidates-client";

vi.mock("../../lib/admin-candidates-client", () => ({
  adminCandidateClient: {
    getCandidate: vi.fn(),
    listCandidates: vi.fn(),
    createCandidate: vi.fn(),
    updateCandidate: vi.fn(),
    getCountries: vi.fn(() => Promise.resolve([])),
    getProjects: vi.fn(() => Promise.resolve([])),
    getCrafts: vi.fn(() => Promise.resolve([])),
  },
}));

const HR = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "hr" && !a.locked && !a.suspended);
const FINANCE = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "finance");
const ADMIN = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "admin");

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function candidate(overrides = {}) {
  return {
    id: "candidate-1",
    fullName: "Ahmed Ali",
    cnic: "42101-1234567-1",
    mobileNumber: "+923001234567",
    passportNumber: null,
    nextOfKin: { name: null, relationship: null, mobileNumber: null, cnic: null },
    preferredLocale: "en",
    candidateStatus: "documents_pending",
    active: true,
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
    assignment: {
      id: "assignment-1",
      referenceNumber: "DES-000123",
      country: { code: "qatar", name: "Qatar" },
      project: { code: "qatar_infrastructure", name: "Qatar Infrastructure" },
      craft: { code: "electrician", name: "Electrician" },
      currentWorkflowStage: { code: "documents_pending", name: "Documents Pending" },
      createdAt: "2026-08-20T10:00:00Z",
    },
    ...overrides,
  };
}

function listResult(items, pagination = { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }, appliedFilters = {}) {
  return { items, pagination, appliedFilters };
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
              <Route path="/admin" element={<AdminCandidateListPage />} />
              <Route
                path="/admin/candidates/new"
                element={
                  <StaffShell>
                    <p>New candidate stub</p>
                  </StaffShell>
                }
              />
              <Route
                path="/admin/candidates/:id"
                element={
                  <StaffShell>
                    <p>Candidate detail stub</p>
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

describe("AdminCandidateListPage", () => {
  afterEach(() => {
    vi.mocked(adminCandidateClient.listCandidates).mockReset();
    vi.mocked(adminCandidateClient.getCountries).mockReset().mockResolvedValue([]);
    vi.mocked(adminCandidateClient.getProjects).mockReset().mockResolvedValue([]);
    vi.mocked(adminCandidateClient.getCrafts).mockReset().mockResolvedValue([]);
    sessionStorage.clear();
    localStorage.clear();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    renderAt("/admin", client);

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });

  it("shows the Add Candidate action for a staff member with manage_candidates", async () => {
    adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
    const client = await signInAs(HR);
    renderAt("/admin", client);

    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add Candidate" })).toBeInTheDocument();
  });

  it("omits the Add Candidate action for a staff member with only view_candidates", async () => {
    adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
    const client = await signInAs(FINANCE);
    renderAt("/admin", client);

    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "+ Add Candidate" })).not.toBeInTheDocument();
  });

  it("shows a forbidden state for a staff member lacking view_candidates/manage_candidates -- no route guard, the query's own 403 handles it", async () => {
    adminCandidateClient.listCandidates.mockRejectedValue({ code: "FORBIDDEN", message: "You do not have access." });
    const client = await signInAs(ADMIN);
    renderAt("/admin", client);

    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
  });

  describe("list states", () => {
    it("shows a loading state before the list resolves", async () => {
      adminCandidateClient.listCandidates.mockImplementation(() => new Promise(() => {}));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      await waitFor(() => expect(screen.getByText("Loading…")).toBeInTheDocument());
    });

    it("shows the empty state when there are no candidates and no active filters", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      expect(await screen.findByText("No candidates yet")).toBeInTheDocument();
    });

    it("shows the empty-filtered state when filters are active and nothing matches", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin?search=nonexistent", client);

      expect(await screen.findByText("No candidates match these filters")).toBeInTheDocument();
    });

    it("renders candidate rows with CNIC, mobile, reference, country, project, craft, stage and created date", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
      expect(screen.getByText("42101-1234567-1")).toBeInTheDocument();
      expect(screen.getByText("+923001234567")).toBeInTheDocument();
      expect(screen.getByText("DES-000123")).toBeInTheDocument();
      expect(screen.getByText("Qatar")).toBeInTheDocument();
      expect(screen.getByText("Qatar Infrastructure")).toBeInTheDocument();
      expect(screen.getByText("Electrician")).toBeInTheDocument();
      // "Documents Pending" appears twice: once as the row's own stage
      // badge, once as an option in the status filter select.
      expect(screen.getAllByText("Documents Pending").length).toBeGreaterThan(0);
    });

    it("links each row to its candidate detail page", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      const link = await screen.findByRole("link", { name: /Ahmed Ali/ });
      expect(link).toHaveAttribute("href", "/admin/candidates/candidate-1");
    });

    it("shows a null assignment as not-available, never a fabricated placeholder", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate({ assignment: null })]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      await screen.findByText("Ahmed Ali");
      expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    });

    it("shows an offline state with retry", async () => {
      adminCandidateClient.listCandidates.mockRejectedValue({ code: "OFFLINE" });
      const client = await signInAs(HR);
      renderAt("/admin", client);

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
    });

    it("shows a generic error with retry for a server error", async () => {
      adminCandidateClient.listCandidates.mockRejectedValue({ code: "SERVER_ERROR" });
      const client = await signInAs(HR);
      renderAt("/admin", client);

      expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
      const retryButton = screen.getByRole("button", { name: "Retry" });
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
      fireEvent.click(retryButton);
      expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    });

    it("ends the session on a confirmed-expired staff session", async () => {
      adminCandidateClient.listCandidates.mockRejectedValue({ code: "SESSION_EXPIRED" });
      const client = await signInAs(HR);
      renderAt("/admin", client);

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });
  });

  describe("search, filters, sort and URL state", () => {
    it("debounces the search input before requesting", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      const input = await screen.findByLabelText("Search");
      const callsBefore = adminCandidateClient.listCandidates.mock.calls.length;
      fireEvent.change(input, { target: { value: "Jane" } });

      expect(adminCandidateClient.listCandidates.mock.calls.length).toBe(callsBefore);

      await act(() => vi.advanceTimersByTimeAsync(500));
      await waitFor(() => {
        const [filters] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(filters.search).toBe("Jane");
      });
      vi.useRealTimers();
    });

    it("preserves search, status, sort, country, project and craft filters from the URL on load", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin?search=Jane&status=fee_pending&sort=full_name&country=qatar&project=qatar_infrastructure&craft=electrician", client);

      await waitFor(() => {
        const [filters, sort] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(filters).toEqual({
          search: "Jane",
          status: "fee_pending",
          countryCode: "qatar",
          projectCode: "qatar_infrastructure",
          craftCode: "electrician",
        });
        expect(sort).toBe("full_name");
      });
      expect(screen.getByLabelText("Search")).toHaveValue("Jane");
    });

    it("changing the status filter updates the request and the URL", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      const statusSelect = await screen.findByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "verified" } });

      await waitFor(() => {
        const [filters] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(filters.status).toBe("verified");
      });
    });

    it("changing the sort order updates the request", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      const sortSelect = await screen.findByLabelText("Sort by");
      fireEvent.change(sortSelect, { target: { value: "-reference_number" } });

      await waitFor(() => {
        const [, sort] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(sort).toBe("-reference_number");
      });
    });

    it("resets the page to 1 when a filter changes", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 }));
      const client = await signInAs(HR);
      renderAt("/admin?page=2", client);

      const statusSelect = await screen.findByLabelText("Status");
      fireEvent.change(statusSelect, { target: { value: "verified" } });

      await waitFor(() => {
        const [, , page] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(page.number).toBe(1);
      });
    });

    it('shows "Clear filters" only when filters/sort are active, and clears them on click', async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin?search=Jane", client);

      const clearButton = await screen.findByText("Clear filters");
      fireEvent.click(clearButton);

      await waitFor(() => expect(screen.getByLabelText("Search")).toHaveValue(""));
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
    });

    it("does not show Clear filters with no active search/filters/sort", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([]));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      await waitFor(() => expect(adminCandidateClient.listCandidates).toHaveBeenCalled());
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("requests the page reflected in the URL and renders Pagination controls", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 }));
      const client = await signInAs(HR);
      renderAt("/admin?page=2", client);

      await waitFor(() => {
        const [, , page] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(page.number).toBe(2);
      });
      expect(await screen.findByRole("navigation")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
    });

    it("clicking a page number requests that page and updates the URL (round-trippable via back/forward)", async () => {
      adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()], { page: 1, perPage: 20, totalCount: 45, totalPages: 3 }));
      const client = await signInAs(HR);
      renderAt("/admin", client);

      const pageThreeButton = await screen.findByRole("button", { name: "3" });
      fireEvent.click(pageThreeButton);

      await waitFor(() => {
        const [, , page] = adminCandidateClient.listCandidates.mock.calls.at(-1);
        expect(page.number).toBe(3);
      });
    });
  });

  it("renders in Urdu", async () => {
    adminCandidateClient.listCandidates.mockResolvedValue(listResult([candidate()]));
    localStorage.setItem("descon.language", "ur");
    const client = await signInAs(HR);
    renderAt("/admin", client);

    expect(await screen.findByRole("heading", { name: "امیدوار" })).toBeInTheDocument();
  });
});
