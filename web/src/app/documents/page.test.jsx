import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { candidateDocumentsClient } from "../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../lib/application-progress-client";
import DocumentsPage from "./page";

vi.mock("../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: vi.fn(), uploadDocument: vi.fn() },
}));

// This page also renders ApplicationProgressSummary -- its own dedicated
// behavior is covered by page.progress.test.jsx. Defaulting to a
// `no_assignment` progress payload here keeps that section a small, static
// empty state that shares no text with any checklist-status assertion in
// this file (a "ready"/full payload would render "Missing"/"Uploaded"/
// "Verified"/etc. count labels that collide with checklist status badges
// using the exact same words).
vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
}));

function noAssignmentProgress() {
  return {
    candidateStatus: "registered",
    currentWorkflowStage: null,
    documents: {
      requiredTotal: 0,
      missing: 0,
      uploaded: 0,
      pendingReview: 0,
      verified: 0,
      rejected: 0,
      submittedTotal: 0,
      completionPercentage: 0,
      canSubmit: false,
      submissionState: "no_assignment",
      blockingRequirements: [],
    },
  };
}

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

function item(overrides = {}) {
  return {
    requirementCode: "passport",
    name: "Passport",
    required: true,
    status: "missing",
    replacementAllowed: true,
    document: null,
    ...overrides,
  };
}

function uploadedDocument(overrides = {}) {
  return {
    id: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
    fileName: "passport.pdf",
    contentType: "application/pdf",
    fileSize: 123456,
    uploadedAt: "2026-08-26T12:00:00Z",
    ...overrides,
  };
}

function pdfFile(name = "passport.pdf", size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

function selectFileOnActiveRow(file) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
}

describe("DocumentsPage", () => {
  beforeEach(() => {
    applicationProgressClient.getProgress.mockResolvedValue(noAssignmentProgress());
  });

  afterEach(() => {
    vi.mocked(candidateDocumentsClient.getChecklist).mockReset();
    vi.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    vi.mocked(applicationProgressClient.getProgress).mockReset();
    vi.mocked(applicationProgressClient.submitDocuments).mockReset();
    // Guaranteed regardless of whether the Urdu test's own assertions
    // passed -- an in-test-body-only cleanup would leak the Urdu locale
    // into every later test if that test failed before reaching it.
    window.localStorage.removeItem("descon.language");
  });

  it("shows a loading state before the checklist resolves", async () => {
    candidateDocumentsClient.getChecklist.mockReturnValue(new Promise(() => {}));
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("shows the empty-checklist state when nothing is required", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("No documents required")).toBeInTheDocument();
  });

  it("renders a missing required document with its localized status and no candidate document details", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByText("Not uploaded yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("renders an optional document labeled Optional", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ required: false, status: "missing" })]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Optional")).toBeInTheDocument();
  });

  it("renders an uploaded document's filename, size and localized date", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "uploaded", document: uploadedDocument() }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Uploaded")).toBeInTheDocument();
    expect(screen.getByText(/passport\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/121 KB|120\.6 KB/)).toBeInTheDocument();
  });

  it("renders a pending-review document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "pending_review", document: uploadedDocument() }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
  });

  it("renders a verified document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Verified")).toBeInTheDocument();
    // replacement_allowed is false -- no interactive action, a clear non-interactive label instead.
    expect(screen.getByText("No action available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
  });

  it("renders a rejected document with a Replace action only when replacement_allowed is true", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument(), replacementAllowed: true }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  it("renders a rejected document with no action when replacement_allowed is false, never inferring permission from status", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
    expect(screen.getByText("No action available")).toBeInTheDocument();
  });

  it("shows the rejection reason and review date for a rejected document, matching mobile's display", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        status: "rejected",
        document: uploadedDocument({ rejectionReason: "Document is unreadable.", reviewedAt: "2026-08-27T09:00:00Z" }),
        replacementAllowed: true,
      }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Document is unreadable\./)).toBeInTheDocument();
    expect(screen.getByText(/Reviewed on/)).toBeInTheDocument();
  });

  it("does not show a rejection reason or review date for a document that has not been reviewed", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
    await signInAndNavigateToDocuments();

    await screen.findByText("passport.pdf");
    expect(screen.queryByText(/Reviewed on/)).not.toBeInTheDocument();
    expect(screen.queryByText("Rejection reason")).not.toBeInTheDocument();
  });

  it("shows the PCC compliance badge and issued/expiry dates for a police-character document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        requirementCode: "police_character",
        name: "Police Character Certificate",
        status: "verified",
        replacementAllowed: false,
        document: uploadedDocument({ issuedOn: "2026-08-01", expiresOn: "2027-02-01", complianceStatus: "current" }),
      }),
    ]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Compliant")).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
  });

  it("never renders a raw status or requirement code as text", async () => {
    // `"unknown"` is what the real client's defensive mapping already
    // normalizes an unrecognized backend status to (see
    // shared/candidateDocuments/realCandidateDocumentsClient.test.ts's
    // "falls back ... to 'unknown'" case) -- this test covers the UI's own
    // safe rendering of that display value, not the mapping itself.
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "unknown" })]);
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("passport")).not.toBeInTheDocument();
  });

  it("never presents a download or preview action for any document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument() }),
    ]);
    await signInAndNavigateToDocuments();

    await screen.findByText("Verified");
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "SESSION_EXPIRED" });
    await signInAndNavigateToDocuments();

    fireEvent.click(await screen.findByRole("button", { name: "Sign in again" }));
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Account inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("shows an offline state with retry", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "OFFLINE" });
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries the checklist fetch after a network/server failure", async () => {
    candidateDocumentsClient.getChecklist
      .mockRejectedValueOnce({ code: "NETWORK_ERROR" })
      .mockResolvedValueOnce([item()]);
    await signInAndNavigateToDocuments();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Passport")).toBeInTheDocument();
  });

  it("never sends a candidate id -- getChecklist is called only with the session access token", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item()]);
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(candidateDocumentsClient.getChecklist).toHaveBeenCalledWith("candidate-access-token");
  });

  it("renders in Urdu when the language is Urdu", async () => {
    // The item `name` is never translated client-side (ticket: "Do not
    // replace the backend-provided document name with a hardcoded frontend
    // name") -- a real backend would send this already localized per
    // X-Locale, so the mock supplies the Urdu name directly, exactly as
    // the real API would.
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ name: "پاسپورٹ", status: "missing" })]);
    window.localStorage.setItem("descon.language", "ur");
    renderDocumentsPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(await screen.findByText("Go to documents"));

    expect(await screen.findByText("پاسپورٹ")).toBeInTheDocument();
    expect(screen.getByText("غیر موجود")).toBeInTheDocument();
  });

  describe("uploading a missing document", () => {
    it("rejects an invalid file type client-side before ever calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(new File(["x"], "resume.docx", { type: "application/msword" }));

      expect(await screen.findByText("Upload a PDF, JPEG, or PNG file.")).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("rejects an empty file client-side", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile("empty.pdf", 0));

      expect(await screen.findByText("This file is empty.")).toBeInTheDocument();
    });

    it("rejects an oversized file client-side", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile("big.pdf", 5 * 1024 * 1024 + 1));

      expect(await screen.findByText("This file is larger than the 5 MB limit.")).toBeInTheDocument();
    });

    it("accepts a valid PDF, shows an uploading state, then shows the updated document after success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      let resolveUpload;
      candidateDocumentsClient.uploadDocument.mockReturnValue(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Uploading…")).toBeInTheDocument();

      resolveUpload(item({ status: "uploaded", document: uploadedDocument() }));
      await waitFor(() => expect(screen.getByText("Uploaded")).toBeInTheDocument());
      expect(screen.getByText(/passport\.pdf/)).toBeInTheDocument();
      // The panel collapses back to the row after success.
      expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    });

    it("never displays a fake upload percentage in the uploading state", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockReturnValue(new Promise(() => {}));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      // Scoped to the uploading indicator itself -- the page separately
      // (and legitimately) shows an overall required-document *submission*
      // percentage elsewhere, which is not a fake per-upload progress value.
      const uploadingMessage = await screen.findByText("Uploading…");
      expect(uploadingMessage.textContent).not.toMatch(/%/);
    });

    it("prevents duplicate submission while an upload is already in flight", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockReturnValue(new Promise(() => {}));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      const submitButton = screen.getByRole("button", { name: "Submit" });
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await screen.findByText("Uploading…");
      expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1);
    });

    it("disables other rows' upload/replace actions while one upload is pending", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "passport", status: "missing" }),
        item({ requirementCode: "cnic_front", name: "CNIC", status: "missing" }),
      ]);
      candidateDocumentsClient.uploadDocument.mockReturnValue(new Promise(() => {}));
      await signInAndNavigateToDocuments();

      const uploadButtons = await screen.findAllByRole("button", { name: "Upload" });
      fireEvent.click(uploadButtons[0]);
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await screen.findByText("Uploading…");
      expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    });

    it("allows removing the selected file and canceling before submission", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      expect(await screen.findByText(/Selected file: passport\.pdf/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByText(/Selected file/)).not.toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("reuses the same idempotency key across a retry of the same file", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument
        .mockRejectedValueOnce({ code: "SERVER_ERROR" })
        .mockResolvedValueOnce(item({ status: "uploaded", document: uploadedDocument() }));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));

      fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(2));

      const [firstCall] = candidateDocumentsClient.uploadDocument.mock.calls[0];
      const [secondCall] = candidateDocumentsClient.uploadDocument.mock.calls[1];
      expect(firstCall.idempotencyKey).toBe(secondCall.idempotencyKey);
    });

    it("generates a new idempotency key after selecting a different file", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockResolvedValue(
        item({ status: "uploaded", document: uploadedDocument() })
      );
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile("first.pdf"));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));

      fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
      selectFileOnActiveRow(pdfFile("second.pdf"));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(2));

      const [firstCall] = candidateDocumentsClient.uploadDocument.mock.calls[0];
      const [secondCall] = candidateDocumentsClient.uploadDocument.mock.calls[1];
      expect(firstCall.idempotencyKey).not.toBe(secondCall.idempotencyKey);
    });

    it("submits the exact multipart fields the backend expects", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockResolvedValue(
        item({ status: "uploaded", document: uploadedDocument() })
      );
      await signInAndNavigateToDocuments();

      const file = pdfFile();
      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(file);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const [call] = candidateDocumentsClient.uploadDocument.mock.calls[0];
      expect(call.requirementCode).toBe("passport");
      expect(call.accessToken).toBe("candidate-access-token");
      expect(call.formData.get("candidate_document[requirement_code]")).toBe("passport");
      expect(call.formData.get("candidate_document[file]")).toBe(file);
    });

    it("handles a 409 idempotency conflict safely, never as success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({
        code: "CONFLICT",
        message: "The idempotency key does not match the original request.",
      });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("The idempotency key does not match the original request.")).toBeInTheDocument();
      expect(screen.queryByText("Uploaded")).not.toBeInTheDocument();
    });

    it("handles a 422 replacement_not_allowed by refreshing the checklist rather than retrying blindly", async () => {
      candidateDocumentsClient.getChecklist
        .mockResolvedValueOnce([item({ status: "rejected", document: uploadedDocument(), replacementAllowed: true })])
        .mockResolvedValueOnce([item({ status: "rejected", document: uploadedDocument(), replacementAllowed: false })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({
        code: "REPLACEMENT_NOT_ALLOWED",
        message: "This document cannot be replaced in its current status.",
      });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("This document cannot be replaced in its current status.")).toBeInTheDocument();
      await waitFor(() => expect(candidateDocumentsClient.getChecklist).toHaveBeenCalledTimes(2));
    });

    it("handles rate limiting safely", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "RATE_LIMITED", retryAfterSeconds: 30 });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Too many attempts. Please wait a moment before trying again.")).toBeInTheDocument();
    });

    it("signs the candidate out when an upload fails because the session is confirmed expired", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "SESSION_EXPIRED" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("signs the candidate out when an upload fails because the account is inactive", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("handles an offline upload failure with retry", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "OFFLINE" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
    });
  });
});
