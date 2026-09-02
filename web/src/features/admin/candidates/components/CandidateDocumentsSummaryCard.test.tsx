import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminDocumentReviewsClient } from "../../../../lib/admin-document-reviews-client";
import { CandidateDocumentsSummaryCard } from "./CandidateDocumentsSummaryCard";

vi.mock("../../../../lib/admin-document-reviews-client", () => ({
  adminDocumentReviewsClient: { getQueue: vi.fn(), getSubmission: vi.fn(), requestDocumentAccess: vi.fn(), verifyDocument: vi.fn(), rejectDocument: vi.fn() },
}));

function queueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission-1",
    candidate: { id: "candidate-1", fullName: "Ahmed Ali" },
    assignment: {
      id: "assignment-1",
      referenceNumber: "REF-100",
      country: { code: "qatar", name: "Qatar" },
      project: { code: "qatar_infrastructure", name: "Qatar Infrastructure" },
      craft: { code: "electrician", name: "Electrician" },
    },
    submittedAt: "2026-08-20T10:00:00Z",
    review: { pendingReview: 1, verified: 0, rejected: 0, requiredTotal: 1, reviewState: "pending_review" },
    ...overrides,
  };
}

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CandidateDocumentsSummaryCard candidateId="candidate-1" />
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("CandidateDocumentsSummaryCard", () => {
  afterEach(() => {
    vi.mocked(adminDocumentReviewsClient.getQueue).mockReset();
  });

  it("scopes the query to this candidate via filter[candidate_public_id]", async () => {
    adminDocumentReviewsClient.getQueue.mockResolvedValue({ items: [], pagination: { page: 1, perPage: 5, totalCount: 0, totalPages: 0 }, summary: undefined });
    renderCard();

    await screen.findByText("No document submissions yet.");
    expect(adminDocumentReviewsClient.getQueue).toHaveBeenCalledWith({ candidatePublicId: "candidate-1" }, { number: 1, size: 5 });
  });

  it("shows a no-submissions message when the candidate has none", async () => {
    adminDocumentReviewsClient.getQueue.mockResolvedValue({ items: [], pagination: { page: 1, perPage: 5, totalCount: 0, totalPages: 0 }, summary: undefined });
    renderCard();

    expect(await screen.findByText("No document submissions yet.")).toBeInTheDocument();
  });

  it("shows the latest submission's review state, submitted date, and a link to it", async () => {
    adminDocumentReviewsClient.getQueue.mockResolvedValue({
      items: [queueItem()],
      pagination: { page: 1, perPage: 5, totalCount: 1, totalPages: 1 },
      summary: undefined,
    });
    renderCard();

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    expect(screen.getByText(/Submitted on/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View submission" });
    expect(link).toHaveAttribute("href", "/admin/document-reviews/submission-1");
  });

  it("links to the document-review queue filtered to this candidate", async () => {
    adminDocumentReviewsClient.getQueue.mockResolvedValue({ items: [], pagination: { page: 1, perPage: 5, totalCount: 0, totalPages: 0 }, summary: undefined });
    renderCard();

    const link = await screen.findByRole("link", { name: "View all submissions" });
    expect(link).toHaveAttribute("href", "/admin/document-reviews?candidateId=candidate-1");
  });

  it("renders nothing for a staff member lacking manage_candidate_documents (FORBIDDEN), rather than a scary error", async () => {
    adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "FORBIDDEN" });
    const { container } = renderCard();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a retry banner for a real failure (e.g. a server error), not just silence", async () => {
    adminDocumentReviewsClient.getQueue.mockRejectedValue({ code: "SERVER_ERROR" });
    renderCard();

    expect(await screen.findByText("Some candidate data couldn't be refreshed.")).toBeInTheDocument();
  });
});
