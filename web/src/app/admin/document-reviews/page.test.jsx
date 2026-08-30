import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import { StaffShell } from "../../components/staff-shell";
import DocumentReviewsPage from "./page";
import { adminDocumentReviewsClient } from "../../../lib/admin-document-reviews-client";

vi.mock("../../../lib/admin-document-reviews-client", () => ({
  adminDocumentReviewsClient: { getQueue: vi.fn(), getSubmission: vi.fn(), requestDocumentAccess: vi.fn(), verifyDocument: vi.fn(), rejectDocument: vi.fn() },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "admin");
const HR = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "hr" && !a.locked && !a.suspended);
const MPS = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "mps");
const FINANCE = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "finance");
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "management");

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function queueItem(overrides = {}) {
  return {
    id: "submission-1",
    candidate: { id: "candidate-1", fullName: "Ahmed Ali" },
    assignment: {
      id: "assignment-1",
      referenceNumber: "REF-100",
      country: { code: "SA", name: "Saudi Arabia" },
      project: { code: "PRJ-1", name: "Project One" },
      craft: { code: "welder", name: "Welder" },
    },
    submittedAt: "2026-08-20T10:00:00Z",
    review: { pendingReview: 1, verified: 0, rejected: 0, requiredTotal: 1, reviewState: "pending_review" },
    ...overrides,
  };
}

function queueResult(items, pagination = { page: 1, perPage: 20, totalCount: items.length, totalPages: 1 }, summary) {
  return { items, pagination, summary };
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
              <Route path="/admin/document-reviews" element={<DocumentReviewsPage />} />
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

describe("DocumentReviewsPage", () => {
  afterEach(() => {
    vi.mocked(adminDocumentReviewsClient.getQueue).mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("authorization", () => {
    it.each([
      ["admin", ADMIN],
      ["hr", HR],
      ["mps", MPS],
    ])("allows a staff member with the %s role to reach the queue", async (_role, account) => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([queueItem()]));
      const client = await signInAs(account);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByRole("heading", { name: "Document Review Queue" })).toBeInTheDocument();
    });

    it.each([
      ["finance", FINANCE],
      ["management", MANAGEMENT],
    ])("redirects a staff member with the %s role to the forbidden route", async (_role, account) => {
      const client = await signInAs(account);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
      expect(adminDocumentReviewsClient.getQueue).not.toHaveBeenCalled();
    });

    it("sends an unauthenticated visitor to staff login", async () => {
      const client = createMockStaffAuthClient({ delayMs: 0 });
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("shows the Document Reviews nav item only for staff with manage_candidate_documents", async () => {
      const withPermission = await signInAs(HR);
      renderAt("/admin", withPermission);
      expect(await screen.findByText("Candidates dashboard stub")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Document Reviews" })).toBeInTheDocument();
    });

    it("never renders the Document Reviews nav item for staff lacking the permission", async () => {
      const withoutPermission = await signInAs(FINANCE);
      renderAt("/admin", withoutPermission);
      expect(await screen.findByText("Candidates dashboard stub")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Document Reviews" })).not.toBeInTheDocument();
    });
  });

  describe("queue states", () => {
    it("shows a loading state before the queue resolves", async () => {
      // `waitFor` + `getByText` here, not `findByText` -- during the race
      // between StaffAuthProvider's async session restore and this query's
      // own pending fetch (both showing the same "Loading…" text),
      // `findByText`'s internal MutationObserver-based polling can miss the
      // transition and report not-found even though a `waitFor(() =>
      // getByText(...))` poll against the same DOM succeeds reliably.
      adminDocumentReviewsClient.getQueue.mockImplementation(() => new Promise(() => {}));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(screen.getByText("Loading…")).toBeInTheDocument());
    });

    it("shows the empty-queue state when there are no submissions and no active filters", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("Nothing to review")).toBeInTheDocument();
    });

    it("shows the empty-filtered-results state when filters are active and nothing matches", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews?status=verified&candidateId=nonexistent", client);

      expect(await screen.findByText("No matching submissions")).toBeInTheDocument();
    });

    it("renders queue rows with candidate, assignment, project, country, craft, submitted date and status", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([queueItem()]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
      expect(screen.getByText("REF-100")).toBeInTheDocument();
      expect(screen.getByText("Project One")).toBeInTheDocument();
      expect(screen.getByText("Saudi Arabia")).toBeInTheDocument();
      expect(screen.getByText("Welder")).toBeInTheDocument();
      // "Pending review" appears twice: once as the (already-selected) status
      // filter chip, once as the row's own status badge.
      expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0);
    });

    it("shows an offline state with retry", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "OFFLINE" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
    });

    it("shows a forbidden state for review_not_allowed", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "REVIEW_NOT_ALLOWED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    });

    it("shows a rate-limit message", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "RATE_LIMITED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("Too many attempts. Please wait a moment before trying again.")).toBeInTheDocument();
    });

    it("shows a generic error with retry for a server error", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "SERVER_ERROR" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
      const retryButton = screen.getByRole("button", { name: "Retry" });
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([queueItem()]));
      fireEvent.click(retryButton);
      expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    });

    it("ends the session on a confirmed-expired staff session", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "SESSION_EXPIRED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("ends the session for an inactive account", async () => {
      adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });
  });

  describe("filters and URL state", () => {
    it("defaults to the backend's own default statuses (pending_review, partially_reviewed) when the URL has no status filter", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(adminDocumentReviewsClient.getQueue).toHaveBeenCalled());
      const [filters] = adminDocumentReviewsClient.getQueue.mock.calls[0];
      expect(filters.status).toEqual(["pending_review", "partially_reviewed"]);
    });

    it("reflects a status filter from the URL as a selected chip and requests it from the backend", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews?status=verified", client);

      expect(await screen.findByRole("button", { name: "Verified", pressed: true })).toBeInTheDocument();
      await waitFor(() => {
        const [filters] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(filters.status).toEqual(["verified"]);
      });
    });

    it("toggling a status chip updates the request and the URL", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      const verifiedChip = await screen.findByRole("button", { name: "Verified" });
      fireEvent.click(verifiedChip);

      await waitFor(() => {
        const [filters] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(filters.status).toEqual(expect.arrayContaining(["pending_review", "partially_reviewed", "verified"]));
      });
    });

    it("debounces the candidate ID text filter before requesting", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      const input = await screen.findByLabelText("Candidate ID");
      const callsBefore = adminDocumentReviewsClient.getQueue.mock.calls.length;
      fireEvent.change(input, { target: { value: "cand-1" } });

      expect(adminDocumentReviewsClient.getQueue.mock.calls.length).toBe(callsBefore);

      await act(() => vi.advanceTimersByTimeAsync(500));
      await waitFor(() => {
        const [filters] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(filters.candidatePublicId).toBe("cand-1");
      });
      vi.useRealTimers();
    });

    it("preserves candidate ID, project and country filters from the URL on load", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews?candidateId=cand-1&project=PRJ-1&country=SA", client);

      expect(await screen.findByLabelText("Candidate ID")).toHaveValue("cand-1");
      expect(screen.getByLabelText("Project code")).toHaveValue("PRJ-1");
      expect(screen.getByLabelText("Country code")).toHaveValue("SA");
    });

    it('shows "Clear filters" only when filters differ from the default, and clears them on click', async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews?candidateId=cand-1", client);

      const clearButton = await screen.findByText("Clear filters");
      fireEvent.click(clearButton);

      await waitFor(() => expect(screen.getByLabelText("Candidate ID")).toHaveValue(""));
    });

    it("offers rejected, expired PCC, and near-expiry PCC as filter chips alongside the 4 review states", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      expect(await screen.findByRole("button", { name: "Rejected" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Expired" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Expiring soon" })).toBeInTheDocument();
    });

    it("toggling the expired-PCC chip requests it from the backend", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      fireEvent.click(await screen.findByRole("button", { name: "Expired" }));

      await waitFor(() => {
        const [filters] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(filters.status).toEqual(expect.arrayContaining(["expired_pcc"]));
      });
    });
  });

  describe("staff compliance summary", () => {
    it("shows aggregate counts reconciling with the queue when the backend returns a summary", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(
        queueResult([queueItem()], undefined, { pendingReview: 3, verified: 5, rejected: 2, expiredPcc: 1, nearExpiryPcc: 4 })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await screen.findByText("Ahmed Ali");
      const summary = screen.getByText("Queue summary").closest("div");
      expect(within(summary).getByText("3")).toBeInTheDocument();
      expect(within(summary).getByText("2")).toBeInTheDocument();
      expect(within(summary).getByText("1")).toBeInTheDocument();
      expect(within(summary).getByText("4")).toBeInTheDocument();
      expect(within(summary).getByText("5")).toBeInTheDocument();
    });

    it("does not render the summary strip when the backend did not return one", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([]));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      await waitFor(() => expect(adminDocumentReviewsClient.getQueue).toHaveBeenCalled());
      expect(screen.queryByText("Queue summary")).not.toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("requests the page reflected in the URL and renders Pagination controls", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(
        queueResult([queueItem()], { page: 2, perPage: 20, totalCount: 45, totalPages: 3 })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews?page=2", client);

      await waitFor(() => {
        const [, page] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(page.number).toBe(2);
      });
      expect(await screen.findByRole("navigation")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
    });

    it("clicking a page number requests that page", async () => {
      adminDocumentReviewsClient.getQueue.mockResolvedValue(
        queueResult([queueItem()], { page: 1, perPage: 20, totalCount: 45, totalPages: 3 })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews", client);

      const pageThreeButton = await screen.findByRole("button", { name: "3" });
      fireEvent.click(pageThreeButton);

      await waitFor(() => {
        const [, page] = adminDocumentReviewsClient.getQueue.mock.calls.at(-1);
        expect(page.number).toBe(3);
      });
    });
  });

  it("renders in Urdu", async () => {
    adminDocumentReviewsClient.getQueue.mockResolvedValue(queueResult([queueItem()]));
    localStorage.setItem("descon.language", "ur");
    const client = await signInAs(ADMIN);
    renderAt("/admin/document-reviews", client);

    expect(await screen.findByText("دستاویزات کے جائزے کی قطار")).toBeInTheDocument();
  });
});
