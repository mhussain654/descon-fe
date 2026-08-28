import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import DocumentReviewDetailPage from "./page";
import { SubmissionDetail } from "../../../../features/admin/documentReviews/components/SubmissionDetail";
import { adminDocumentReviewsClient } from "../../../../lib/admin-document-reviews-client";

vi.mock("../../../../lib/admin-document-reviews-client", () => ({
  adminDocumentReviewsClient: {
    getQueue: vi.fn(),
    getSubmission: vi.fn(),
    requestDocumentAccess: vi.fn(),
    verifyDocument: vi.fn(),
    rejectDocument: vi.fn(),
  },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "admin");
const FINANCE = MOCK_STAFF_ACCOUNTS.find((a) => a.role === "finance");

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function submissionDetail(overrides = {}) {
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
    documents: [passportDocument()],
    ...overrides,
  };
}

function passportDocument(overrides = {}) {
  return {
    id: "doc-1",
    requirementCode: "passport",
    required: true,
    name: "Passport",
    fileName: "passport.pdf",
    contentType: "application/pdf",
    fileSize: 123456,
    uploadedAt: "2026-08-19T12:00:00Z",
    status: "pending_review",
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
              <Route path="/admin/document-reviews" element={<p>Queue stub</p>} />
              <Route
                path="/admin/document-reviews/:id"
                element={<DocumentReviewDetailPage params={{ id: "submission-1" }} />}
              />
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

describe("DocumentReviewDetailPage", () => {
  afterEach(() => {
    vi.mocked(adminDocumentReviewsClient.getSubmission).mockReset();
    vi.mocked(adminDocumentReviewsClient.requestDocumentAccess).mockReset();
    vi.mocked(adminDocumentReviewsClient.verifyDocument).mockReset();
    vi.mocked(adminDocumentReviewsClient.rejectDocument).mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe("authorization", () => {
    it("allows a staff member with manage_candidate_documents to reach the detail screen", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByRole("heading", { name: "Submission details" })).toBeInTheDocument();
    });

    it("redirects a staff member lacking the permission to the forbidden route", async () => {
      const client = await signInAs(FINANCE);
      renderAt("/admin/document-reviews/submission-1", client);

      await waitFor(() => expect(screen.getByText("Forbidden stub")).toBeInTheDocument());
      expect(adminDocumentReviewsClient.getSubmission).not.toHaveBeenCalled();
    });
  });

  describe("safe metadata display", () => {
    it("shows required/optional, filename, content type, file size, uploaded time and status, but no raw codes or internal IDs", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText("Passport")).toBeInTheDocument();
      expect(screen.getByText("Required")).toBeInTheDocument();
      expect(screen.getByText("passport.pdf")).toBeInTheDocument();
      expect(screen.getByText("application/pdf")).toBeInTheDocument();
      expect(screen.getByText("120.6 KB")).toBeInTheDocument();
      expect(screen.getByText("Pending review")).toBeInTheDocument();
      // Never the raw backend status/requirement code.
      expect(screen.queryByText("pending_review")).not.toBeInTheDocument();
      expect(screen.queryByText("passport", { exact: true })).not.toBeInTheDocument();
    });

    it("shows reviewer, decision date and rejection reason only when the backend returned them", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({
          documents: [
            passportDocument({
              status: "rejected",
              verifiedAt: "2026-08-21T09:00:00Z",
              rejectionReason: "Document is unreadable.",
              reviewerId: "staff-public-id-1",
            }),
          ],
        })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText("Document is unreadable.")).toBeInTheDocument();
      expect(screen.getByText("staff-public-id-1")).toBeInTheDocument();
    });

    it("does not render a decision date, reviewer or rejection reason for a document with none", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      await screen.findByText("Passport");
      expect(screen.queryByText("Decision date")).not.toBeInTheDocument();
      expect(screen.queryByText("Reviewed by")).not.toBeInTheDocument();
      expect(screen.queryByText("Rejection reason")).not.toBeInTheDocument();
    });

    it("does not show Verify/Reject actions for a document that isn't pending review", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({ documents: [passportDocument({ status: "verified", verifiedAt: "2026-08-21T09:00:00Z" })] })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      await screen.findByText("Passport");
      expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    });

    it("shows an empty state when the submission has no documents", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail({ documents: [] }));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText("No documents in this submission.")).toBeInTheDocument();
    });
  });

  describe("states", () => {
    it("shows an offline state with retry", async () => {
      adminDocumentReviewsClient.getSubmission.mockRejectedValue({ code: "OFFLINE" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
    });

    it("shows a not-found error", async () => {
      adminDocumentReviewsClient.getSubmission.mockRejectedValue({ code: "DOCUMENT_SUBMISSION_NOT_FOUND" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText("Submission not found.")).toBeInTheDocument();
    });

    it("ends the session on a confirmed-expired staff session", async () => {
      adminDocumentReviewsClient.getSubmission.mockRejectedValue({ code: "SESSION_EXPIRED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("never displays a raw project, country or craft code when the backend didn't return a name", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({
          assignment: {
            id: "assignment-1",
            referenceNumber: "REF-100",
            country: { code: "SA" },
            project: { code: "PRJ-1" },
            craft: { code: "welder" },
          },
        })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findAllByText("Name unavailable")).toHaveLength(3);
      expect(screen.queryByText("SA")).not.toBeInTheDocument();
      expect(screen.queryByText("PRJ-1")).not.toBeInTheDocument();
      expect(screen.queryByText("welder")).not.toBeInTheDocument();
    });
  });

  // Review finding: "Session errors from preview and review mutations do
  // not end the session" -- SubmissionDetail previously only watched the
  // submission query's error, missing a SESSION_EXPIRED/INACTIVE_ACCOUNT
  // surfaced by requesting preview access or by a verify/reject decision.
  describe("session ending from any operation", () => {
    it("ends the session when requesting preview access returns SESSION_EXPIRED", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockRejectedValue({ code: "SESSION_EXPIRED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("ends the session when requesting preview access returns INACTIVE_ACCOUNT", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("ends the session when verification returns SESSION_EXPIRED", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.verifyDocument.mockRejectedValue({ code: "SESSION_EXPIRED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Verify" }));
      fireEvent.click(await screen.findByRole("button", { name: "Verify", exact: false }));

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });

    it("ends the session when rejection returns INACTIVE_ACCOUNT", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Blurry photo." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
    });
  });

  describe("secure document preview", () => {
    it("does not request access until the reviewer clicks Preview", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      await screen.findByText("Passport");
      expect(adminDocumentReviewsClient.requestDocumentAccess).not.toHaveBeenCalled();
    });

    it("requests access only after Preview is clicked, and renders a PDF preview", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "doc-1",
        url: "/rails/active_storage/blobs/redirect/xyz/passport.pdf",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(adminDocumentReviewsClient.requestDocumentAccess).toHaveBeenCalledWith("doc-1"));
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).toBeInTheDocument());
    });

    it("shows an unsupported-preview state for an unexpected content type", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({ documents: [passportDocument({ contentType: "application/msword" })] })
      );
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "doc-1",
        url: "/rails/blobs/xyz",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      expect(await screen.findByText("Preview not available")).toBeInTheDocument();
    });

    it("clears access when the preview dialog is closed", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "doc-1",
        url: "/rails/blobs/xyz",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Preview" }));
      await waitFor(() => expect(adminDocumentReviewsClient.requestDocumentAccess).toHaveBeenCalledTimes(2));
    });

    it("never renders the access path as a downloadable link", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "doc-1",
        url: "/rails/active_storage/blobs/redirect/xyz/passport.pdf",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).toBeInTheDocument());

      expect(document.querySelector("a[download]")).not.toBeInTheDocument();
      expect(screen.queryByText(/active_storage/)).not.toBeInTheDocument();
    });

    it("does not restore access if the preview is closed before the access response resolves", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      let resolveAccess;
      adminDocumentReviewsClient.requestDocumentAccess.mockReturnValue(
        new Promise((resolve) => {
          resolveAccess = resolve;
        })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await screen.findByText("Loading…");
      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      resolveAccess({
        documentId: "doc-1",
        url: "/rails/blobs/xyz",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).not.toBeInTheDocument());
    });

    it("does not let a slower access response for a previously-opened document overwrite the one currently shown", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({ documents: [passportDocument({ id: "doc-1", name: "Passport" }), passportDocument({ id: "doc-2", name: "CNIC" })] })
      );
      let resolveFirst;
      adminDocumentReviewsClient.requestDocumentAccess
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            })
        )
        .mockResolvedValueOnce({ documentId: "doc-2", url: "/rails/blobs/two", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      const previewButtons = await screen.findAllByRole("button", { name: "Preview" });
      fireEvent.click(previewButtons[0]);
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      fireEvent.click(previewButtons[1]);

      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).toBeInTheDocument());
      resolveFirst({ documentId: "doc-1", url: "/rails/blobs/one", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });

      await waitFor(() => expect(document.querySelector("embed").getAttribute("src")).toContain("/rails/blobs/two"));
    });

    // The page-level harness above maps every `:id` to a fixed `params.id`,
    // so real client-side navigation between two different submissions
    // can't be exercised through it -- rendering SubmissionDetail directly
    // and changing its `submissionId` prop across a rerender is the precise
    // way to exercise the same effect (`useEffect(() => {...}, [submissionId])`)
    // that a real navigation between detail pages would trigger.
    it("clears a still-pending preview access when the submissionId prop changes (navigating to a different submission)", async () => {
      adminDocumentReviewsClient.getSubmission.mockImplementation((id) =>
        Promise.resolve(submissionDetail({ id, documents: [passportDocument({ id: `doc-${id}` })] }))
      );
      let resolveAccess;
      adminDocumentReviewsClient.requestDocumentAccess.mockReturnValue(
        new Promise((resolve) => {
          resolveAccess = resolve;
        })
      );
      const client = await signInAs(ADMIN);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { rerender } = render(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <StaffAuthProvider client={client}>
                <SubmissionDetail submissionId="submission-1" />
              </StaffAuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await screen.findByText("Loading…");

      rerender(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <StaffAuthProvider client={client}>
                <SubmissionDetail submissionId="submission-2" />
              </StaffAuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );
      await screen.findByText("Passport");

      resolveAccess({ documentId: "doc-submission-1", url: "/rails/blobs/stale", expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).not.toBeInTheDocument());
    });

    it("shows the expired state and requests a new access on demand, without auto-refetching", async () => {
      // Real timers throughout (not fake ones): RTL's waitFor/findBy* poll
      // via real setTimeout, so faking timers here would freeze them too --
      // a short real expiry is simpler and avoids that whole class of bugs.
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "doc-1",
        url: "/rails/blobs/xyz",
        expiresAt: new Date(Date.now() + 50).toISOString(),
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
      await waitFor(() => expect(document.querySelector('embed[type="application/pdf"]')).toBeInTheDocument());

      expect(await screen.findByText("This preview link has expired.", {}, { timeout: 2000 })).toBeInTheDocument();
    });
  });

  describe("verification", () => {
    it("requires confirmation before verifying", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Verify" }));
      expect(await screen.findByText("Verify this document?")).toBeInTheDocument();
      expect(adminDocumentReviewsClient.verifyDocument).not.toHaveBeenCalled();
    });

    it("verifies successfully with an idempotency key, then refreshes and closes", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.verifyDocument.mockResolvedValue({
        document: passportDocument({ status: "verified", verifiedAt: "2026-08-21T09:00:00Z" }),
        submission: { id: "submission-1", review: { pendingReview: 0, verified: 1, rejected: 0, requiredTotal: 1, reviewState: "verified" } },
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Verify" }));
      fireEvent.click(await screen.findByRole("button", { name: "Verify", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.verifyDocument).toHaveBeenCalledTimes(1));
      const [, idempotencyKey] = adminDocumentReviewsClient.verifyDocument.mock.calls[0];
      expect(typeof idempotencyKey).toBe("string");
      expect(idempotencyKey.length).toBeGreaterThan(0);
      expect(screen.queryByText("Verify this document?")).not.toBeInTheDocument();
    });

    it("prevents duplicate submission while verification is pending", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.verifyDocument.mockReturnValue(new Promise(() => {}));
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Verify" }));
      const confirmButtons = await screen.findAllByRole("button", { name: "Verify" });
      const confirmButton = confirmButtons.at(-1);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      await waitFor(() => expect(adminDocumentReviewsClient.verifyDocument).toHaveBeenCalledTimes(1));
    });
  });

  describe("rejection", () => {
    it("requires a reason and shows the backend's field validation", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValue({
        code: "REJECTION_REASON_REQUIRED",
        message: "Enter a reason for rejecting this document.",
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.click(await screen.findByRole("button", { name: "Reject", exact: false }));

      expect(await screen.findByText("Enter a reason for rejecting this document.")).toBeInTheDocument();
    });

    it("rejects successfully with the typed reason and an idempotency key", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockResolvedValue({
        document: passportDocument({ status: "rejected", rejectionReason: "Document is unreadable." }),
        submission: { id: "submission-1", review: { pendingReview: 0, verified: 0, rejected: 1, requiredTotal: 1, reviewState: "changes_required" } },
      });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Document is unreadable." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledWith("doc-1", "Document is unreadable.", expect.any(String)));
    });

    it("preserves the typed reason after a retryable network failure, and retries with the same key", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValueOnce({ code: "NETWORK_ERROR" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Blurry photo." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(1));
      expect(screen.getByLabelText("Reason")).toHaveValue("Blurry photo.");

      adminDocumentReviewsClient.rejectDocument.mockResolvedValueOnce({
        document: passportDocument({ status: "rejected", rejectionReason: "Blurry photo." }),
        submission: { id: "submission-1", review: { pendingReview: 0, verified: 0, rejected: 1, requiredTotal: 1, reviewState: "changes_required" } },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(2));
      const [firstCall, secondCall] = adminDocumentReviewsClient.rejectDocument.mock.calls;
      expect(secondCall[2]).toBe(firstCall[2]);
    });

    it("uses a fresh idempotency key after changing the reason", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValueOnce({ code: "NETWORK_ERROR" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Blurry photo." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));
      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(1));

      adminDocumentReviewsClient.rejectDocument.mockResolvedValueOnce({
        document: passportDocument({ status: "rejected", rejectionReason: "Wrong document type." }),
        submission: { id: "submission-1", review: { pendingReview: 0, verified: 0, rejected: 1, requiredTotal: 1, reviewState: "changes_required" } },
      });
      fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Wrong document type." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(2));
      const [firstCall, secondCall] = adminDocumentReviewsClient.rejectDocument.mock.calls;
      expect(secondCall[2]).not.toBe(firstCall[2]);
    });

    it("shows a visible idempotency-conflict message, keeps the dialog open, and requires a fresh attempt", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValueOnce({ code: "IDEMPOTENCY_CONFLICT" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Blurry photo." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));
      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(1));

      // The reviewer must see *why* nothing obviously happened -- not just a
      // silently-cleared key (review finding: "Idempotency conflict is
      // hidden from the reviewer").
      expect(
        await screen.findByText("This request couldn't be repeated safely. Confirm again to make a fresh attempt.")
      ).toBeInTheDocument();
      expect(screen.getByText("Reject this document?")).toBeInTheDocument();

      adminDocumentReviewsClient.rejectDocument.mockResolvedValueOnce({
        document: passportDocument({ status: "rejected", rejectionReason: "Blurry photo." }),
        submission: { id: "submission-1", review: { pendingReview: 0, verified: 0, rejected: 1, requiredTotal: 1, reviewState: "changes_required" } },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledTimes(2));
      const [firstCall, secondCall] = adminDocumentReviewsClient.rejectDocument.mock.calls;
      expect(secondCall[2]).not.toBe(firstCall[2]);
    });

    it("closes and refreshes when the document was already reviewed by someone else", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
      adminDocumentReviewsClient.rejectDocument.mockRejectedValue({ code: "DOCUMENT_ALREADY_REVIEWED" });
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
      fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Blurry photo." } });
      fireEvent.click(screen.getByRole("button", { name: "Reject", exact: false }));

      await waitFor(() => expect(screen.queryByText("Reject this document?")).not.toBeInTheDocument());
      await waitFor(() => expect(adminDocumentReviewsClient.getSubmission).toHaveBeenCalledTimes(2));
    });

    it("does not render the rejection reason as HTML", async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(
        submissionDetail({
          documents: [passportDocument({ status: "rejected", rejectionReason: "<b>bad</b> document" })],
        })
      );
      const client = await signInAs(ADMIN);
      renderAt("/admin/document-reviews/submission-1", client);

      expect(await screen.findByText(/bad<\/b> document|<b>bad<\/b> document/)).toBeInTheDocument();
      expect(document.querySelector("b")).not.toBeInTheDocument();
    });
  });

  it("renders in Urdu", async () => {
    localStorage.setItem("descon.language", "ur");
    adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail());
    const client = await signInAs(ADMIN);
    renderAt("/admin/document-reviews/submission-1", client);

    expect(await screen.findByText("درخواست کی تفصیلات")).toBeInTheDocument();
  });
});
