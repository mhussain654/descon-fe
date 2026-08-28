// Covers the candidate application-progress and document-submission flow
// (ticket: "Candidate Application Progress and Document Submission"),
// composed onto the same DocumentsPage as the document checklist (PR #8).
// Wire-level client behavior (headers, empty body, idempotency key) is
// tested exhaustively once in
// shared/applicationProgress/realApplicationProgressClient.test.ts; these
// tests mock the client boundary and focus on user-observable page behavior.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { candidateDocumentsClient } from "../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../lib/application-progress-client";
import DocumentsPage from "./page";

vi.mock("../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: vi.fn(), uploadDocument: vi.fn() },
}));
vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
}));

function LoginStub() {
  const { login } = useAuth();
  return (
    <div>
      <p>Login screen</p>
      <button
        type="button"
        onClick={() =>
          login({
            accessToken: "candidate-access-token",
            refreshToken: "refresh",
            candidateId: "candidate-public-id-1",
            candidateName: "Ahmed Ali",
            preferredLocale: "en",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          })
        }
      >
        login
      </button>
      <Link to="/documents">Go to documents</Link>
    </div>
  );
}

function renderDocumentsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/documents" element={<DocumentsPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

async function signInAndNavigateToDocuments() {
  renderDocumentsPage();
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to documents"));
}

function documentsSummary(overrides = {}) {
  return {
    requiredTotal: 2,
    missing: 0,
    uploaded: 0,
    pendingReview: 0,
    verified: 0,
    rejected: 0,
    submittedTotal: 0,
    completionPercentage: 0,
    canSubmit: false,
    submissionState: "incomplete",
    blockingRequirements: [],
    ...overrides,
  };
}

function progress(overrides = {}) {
  return {
    candidateStatus: "registered",
    currentWorkflowStage: { code: "registered", name: "Registered" },
    documents: documentsSummary(),
    ...overrides,
  };
}

function submissionResult(overrides = {}) {
  return {
    message: "Documents submitted for review.",
    submissionId: "0f5b8c9a-4f88-440d-94eb-cf70f780ff95",
    submittedAt: "2026-08-26T12:00:00Z",
    submissionState: "submitted",
    documents: { requiredTotal: 2, pendingReview: 2, canSubmit: false },
    ...overrides,
  };
}

describe("DocumentsPage -- application progress & submission", () => {
  afterEach(() => {
    vi.mocked(candidateDocumentsClient.getChecklist).mockReset();
    vi.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    vi.mocked(applicationProgressClient.getProgress).mockReset();
    vi.mocked(applicationProgressClient.submitDocuments).mockReset();
    window.localStorage.removeItem("descon.language");
  });

  it("shows a loading state before progress resolves", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    await signInAndNavigateToDocuments();

    expect(await screen.findAllByText("Loading…")).not.toHaveLength(0);
  });

  it("shows an informative empty state for no_assignment, not an error", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ currentWorkflowStage: null, documents: documentsSummary({ requiredTotal: 0, submissionState: "no_assignment" }) })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("No assignment yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an informative empty state for no_requirements, not an error", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ requiredTotal: 0, submissionState: "no_requirements" }) })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("No documents required")).toBeInTheDocument();
  });

  it("shows blocking documents and no enabled submit action for incomplete", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({
          submissionState: "incomplete",
          canSubmit: false,
          blockingRequirements: [{ requirementCode: "passport", name: "Passport", reason: "missing" }],
        }),
      })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Documents incomplete")).toBeInTheDocument();
    expect(screen.getByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Not uploaded yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });

  it("shows an enabled submit action only when can_submit is true (ready)", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "ready", canSubmit: true, completionPercentage: 100 }) })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Ready to submit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });

  it("shows blocking documents with a replace reason for changes_required, and no enabled submit action", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        documents: documentsSummary({
          submissionState: "changes_required",
          canSubmit: false,
          blockingRequirements: [{ requirementCode: "passport", name: "Passport", reason: "rejected" }],
        }),
      })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Changes required")).toBeInTheDocument();
    expect(screen.getByText("Rejected — replace this document")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });

  it.each([
    ["submitted", "Submitted for review"],
    ["partially_verified", "Partially verified"],
    ["verified", "Verified"],
  ])("shows no enabled submit action for %s", async (submissionState, label) => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState, canSubmit: false, completionPercentage: 100 }) })
    );
    await signInAndNavigateToDocuments();

    // "Verified" is ambiguous by itself for the `verified` case -- it's
    // both the submission-state badge and a document-count label -- so this
    // asserts presence rather than a single unique match.
    await waitFor(() => expect(screen.getAllByText(label).length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });

  it("falls back an unrecognized submission state to a neutral, non-crashing display", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "unknown", canSubmit: false }) })
    );
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
  });

  describe("submission confirmation", () => {
    async function readyState() {
      candidateDocumentsClient.getChecklist.mockResolvedValue([]);
      applicationProgressClient.getProgress.mockResolvedValue(
        progress({ documents: documentsSummary({ submissionState: "ready", canSubmit: true }) })
      );
      await signInAndNavigateToDocuments();
      fireEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    }

    it("opens a confirmation dialog before submitting", async () => {
      await readyState();
      expect(await screen.findByText("Submit documents for review?")).toBeInTheDocument();
      expect(applicationProgressClient.submitDocuments).not.toHaveBeenCalled();
    });

    it("cancels without submitting", async () => {
      await readyState();
      await screen.findByText("Submit documents for review?");
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());
      expect(applicationProgressClient.submitDocuments).not.toHaveBeenCalled();
    });

    it("submits on confirmation, shows the updated progress and checklist afterward", async () => {
      applicationProgressClient.submitDocuments.mockResolvedValue(submissionResult());
      await readyState();
      await screen.findByText("Submit documents for review?");

      // The refetch after success returns a "submitted" progress -- set up
      // before confirming so it's ready the instant invalidation refetches.
      applicationProgressClient.getProgress.mockResolvedValue(
        progress({ documents: documentsSummary({ submissionState: "submitted", canSubmit: false, pendingReview: 2 }) })
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());
      expect(await screen.findByText("Submitted for review")).toBeInTheDocument();
      expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1);
    });

    it("prevents duplicate submission while a submission is already in flight", async () => {
      applicationProgressClient.submitDocuments.mockReturnValue(new Promise(() => {}));
      await readyState();
      await screen.findByText("Submit documents for review?");

      const confirmButton = screen.getByRole("button", { name: "Submit" });
      fireEvent.click(confirmButton);
      await waitFor(() => expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1));
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1);
    });

    it("retries a failed submission with the same idempotency key after a server error", async () => {
      applicationProgressClient.submitDocuments
        .mockRejectedValueOnce({ code: "SERVER_ERROR" })
        .mockResolvedValueOnce(submissionResult());
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("Something went wrong.");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());

      const [firstCall, secondCall] = applicationProgressClient.submitDocuments.mock.calls;
      expect(firstCall[0].idempotencyKey).toBe(secondCall[0].idempotencyKey);
    });

    it("generates a fresh idempotency key after an idempotency conflict", async () => {
      applicationProgressClient.submitDocuments
        .mockRejectedValueOnce({ code: "CONFLICT" })
        .mockResolvedValueOnce(submissionResult());
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("This submission could not be confirmed. Try submitting again.");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());

      const [firstCall, secondCall] = applicationProgressClient.submitDocuments.mock.calls;
      expect(firstCall[0].idempotencyKey).not.toBe(secondCall[0].idempotencyKey);
    });

    it("closes the dialog and refreshes progress on documents_incomplete rather than offering an automatic retry", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValue({
        code: "DOCUMENTS_INCOMPLETE",
        blockingRequirements: [{ requirementCode: "cnic_front", name: "CNIC (Front)", reason: "missing" }],
      });
      await readyState();
      await screen.findByText("Submit documents for review?");

      applicationProgressClient.getProgress.mockResolvedValue(
        progress({
          documents: documentsSummary({
            submissionState: "incomplete",
            canSubmit: false,
            blockingRequirements: [{ requirementCode: "cnic_front", name: "CNIC (Front)", reason: "missing" }],
          }),
        })
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());
      expect(await screen.findByText("Documents incomplete")).toBeInTheDocument();
      expect(screen.getByText("CNIC (Front)")).toBeInTheDocument();
    });

    it("shows the already-submitted state rather than a generic error on already_submitted", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValue({ code: "ALREADY_SUBMITTED" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      applicationProgressClient.getProgress.mockResolvedValue(
        progress({ documents: documentsSummary({ submissionState: "submitted", canSubmit: false }) })
      );

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());
      expect(await screen.findByText("Submitted for review")).toBeInTheDocument();
    });

    it("shows a localized rate-limit message and allows retry", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValueOnce({ code: "RATE_LIMITED" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(await screen.findByText("Too many attempts. Please wait a moment before trying again.")).toBeInTheDocument();
      expect(screen.getByText("Submit documents for review?")).toBeInTheDocument();
    });

    it("shows an offline message and allows retry", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValueOnce({ code: "OFFLINE" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      expect(await screen.findByText("Check your internet connection and try again.")).toBeInTheDocument();
    });

    it("ends the session and returns to sign-in on a 401 during submission", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValue({ code: "SESSION_EXPIRED" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("ends the session and shows the inactive-account flow on inactive_account during submission", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });
  });

  it("never sends a candidate id, assignment id, document id or requirement code when submitting", async () => {
    applicationProgressClient.submitDocuments.mockResolvedValue(submissionResult());
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ submissionState: "ready", canSubmit: true }) })
    );
    await signInAndNavigateToDocuments();

    fireEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1));
    const call = applicationProgressClient.submitDocuments.mock.calls[0][0];
    expect(Object.keys(call).sort()).toEqual(["accessToken", "idempotencyKey"]);
  });

  it("renders progress in Urdu when the language is Urdu", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({
        currentWorkflowStage: { code: "registered", name: "رجسٹرڈ" },
        documents: documentsSummary({ submissionState: "ready", canSubmit: true, completionPercentage: 100 }),
      })
    );
    window.localStorage.setItem("descon.language", "ur");
    renderDocumentsPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(await screen.findByText("Go to documents"));

    expect(await screen.findByText("جمع کرانے کے لیے تیار")).toBeInTheDocument();
    expect(screen.getByText("رجسٹرڈ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "جائزے کے لیے جمع کرائیں" })).toBeInTheDocument();
  });
});
