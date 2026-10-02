import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "jest-axe";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { toast } from "../../design-system";
import { candidateDocumentsClient } from "../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../lib/application-progress-client";
import { candidateBankDetailsClient } from "../../lib/candidate-bank-details-client";
import DocumentsPage from "./page";

vi.mock("../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: vi.fn(), uploadDocument: vi.fn(), requestDocumentAccess: vi.fn() },
}));
vi.mock("../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: vi.fn(), submitDocuments: vi.fn() },
}));
vi.mock("../../lib/candidate-bank-details-client", () => ({
  candidateBankDetailsClient: { getBankDetail: vi.fn(), submitBankDetail: vi.fn() },
}));

function bankDetailSummary(overrides = {}) {
  return { status: "missing", bankDetail: null, ...overrides };
}

function bankDetail(overrides = {}) {
  return {
    id: "d86f5c87-4379-433a-9a29-c8c3d51f859a",
    status: "submitted",
    accountTitle: "Ahmed Ali",
    accountNumber: "****************6702",
    bankName: "Meezan Bank",
    proof: { fileName: "cheque.pdf", contentType: "application/pdf", fileSize: 123456, uploadedAt: "2026-08-28T12:00:00Z" },
    submittedAt: "2026-08-28T12:00:00Z",
    updatedAt: "2026-08-28T12:00:00Z",
    ...overrides,
  };
}

function documentsSummary(overrides = {}) {
  return {
    requiredTotal: 1,
    missing: 1,
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
    documents: { requiredTotal: 1, pendingReview: 1, canSubmit: false },
    ...overrides,
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
            consent: { currentPolicyVersion: "v1", accepted: true, acceptedAt: "2026-09-06T12:00:00Z" },
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
  const rendered = renderDocumentsPage();
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to documents"));
  return rendered;
}

/** Test-only harness: mounted alongside DocumentsPage inside the same AuthProvider so a test can end the session mid-flight, mirroring how a real logout could race an in-flight upload's response. */
function LogoutTrigger() {
  const { logout } = useAuth();
  return (
    <button type="button" onClick={() => logout()}>
      test-logout-trigger
    </button>
  );
}

async function signInAndNavigateToDocumentsWithLogoutTrigger() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route
                path="/documents"
                element={
                  <>
                    <DocumentsPage />
                    <LogoutTrigger />
                  </>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to documents"));
}

/** Backend upload rules for an ordinary single-file document. */
const SINGLE_FILE_RULES = {
  minimumFiles: 1,
  maximumFiles: 1,
  combinedPdfAllowed: false,
  allowedSideCodes: [],
  acceptedContentTypes: ["application/pdf", "image/jpeg", "image/png"],
  maximumFileSize: 5 * 1024 * 1024,
};

function item(overrides = {}) {
  return {
    requirementCode: "passport",
    name: "Passport",
    required: true,
    displayPosition: 1,
    instructions: null,
    uploadRules: SINGLE_FILE_RULES,
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
    files: [
      { id: "file-1", sideCode: null, position: 1, fileName: "passport.pdf", contentType: "application/pdf", fileSize: 123456 },
    ],
    ...overrides,
  };
}

function pdfFile(name = "passport.pdf", size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" });
}

function imageFile(name = "photo.jpg", size = 1024, type = "image/jpeg") {
  return new File([new Uint8Array(size)], name, { type });
}

function selectFileOnActiveRow(file) {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [file] } });
}

// jsdom does not implement createObjectURL/revokeObjectURL at all -- stubbed
// here (not globally) since only this file's new image-preview tests need
// them; every other test in this suite only ever selects a PDF.
window.URL.createObjectURL = vi.fn(() => "blob:mock-preview-url");
window.URL.revokeObjectURL = vi.fn();

describe("DocumentsPage", () => {
  // Every test renders the page, and BankDetailsPanel unconditionally
  // queries bank-detail state as soon as it mounts -- default it to the
  // "missing" state here so the ~50 pre-existing tests below (none of
  // which are about bank details) don't each need their own mock, matching
  // this file's already-established convention of module-level default
  // mocks (see applicationProgressClient/candidateDocumentsClient above).
  beforeEach(() => {
    candidateBankDetailsClient.getBankDetail.mockResolvedValue(bankDetailSummary());
  });

  afterEach(() => {
    vi.mocked(candidateDocumentsClient.getChecklist).mockReset();
    vi.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    vi.mocked(candidateDocumentsClient.requestDocumentAccess).mockReset();
    vi.mocked(applicationProgressClient.getProgress).mockReset();
    vi.mocked(applicationProgressClient.submitDocuments).mockReset();
    vi.mocked(candidateBankDetailsClient.getBankDetail).mockReset();
    vi.mocked(candidateBankDetailsClient.submitBankDetail).mockReset();
    window.localStorage.removeItem("descon.language");
  });

  it("shows a loading state before the checklist resolves", async () => {
    candidateDocumentsClient.getChecklist.mockReturnValue(new Promise(() => {}));
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty state, not zeroed stat tiles, when the checklist has no requirements", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ requiredTotal: 0 }) }));
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("No documents required")).toBeInTheDocument();
    expect(screen.queryByText("There is nothing to upload right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
  });

  it("shows the real stat tile counts, not the old prototype's mock numbers", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "verified", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ verified: 3, pendingReview: 2, missing: 5 }) })
    );
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("has no automatically detectable accessibility violations", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "missing" }),
      item({ requirementCode: "cnic_front", name: "CNIC (Front)", status: "uploaded", document: uploadedDocument() }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
    const { container } = await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    await screen.findByText("Incomplete");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders a missing required document with its localized status, and an Upload action", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Pending • Required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("does not show a Required suffix for an optional document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ required: false, status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.queryByText(/Required/)).not.toBeInTheDocument();
  });

  it("renders an uploaded document's filename and status", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Uploaded/)).toBeInTheDocument();
  });

  it("renders a pending-review document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "pending_review", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.getAllByText(/Pending review/).length).toBeGreaterThan(0);
  });

  it("gives each status's sub-label its own color instead of one shared color for every status", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "passport", name: "Passport", status: "verified", document: uploadedDocument() }),
      item({ requirementCode: "cnic_front", name: "CNIC (Front)", status: "uploaded", document: uploadedDocument() }),
      item({ requirementCode: "cnic_back", name: "CNIC (Back)", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    const verifiedLine = (await screen.findByText(/Verified •/)).closest("div");
    const uploadedLine = screen.getByText(/Uploaded •/).closest("div");
    const missingLine = screen.getByText("Pending • Required").closest("div");

    expect(verifiedLine).toHaveClass("text-[#10B981]");
    expect(uploadedLine).toHaveClass("text-[#0066CC]");
    expect(missingLine).toHaveClass("text-[#6B7280]");
  });

  it("renders a verified document with no action, even though replacementAllowed happens to be true", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.getAllByText(/Verified/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
  });

  it("renders a rejected document with a Replace action only when replacement_allowed is true", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument(), replacementAllowed: true }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Rejected/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
  });

  it("renders a rejected document with no action when replacement_allowed is false, never inferring permission from status", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Rejected/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
  });

  it("shows the rejection reason for a rejected document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument({ rejectionReason: "Document is unreadable." }), replacementAllowed: true }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Document is unreadable.")).toBeInTheDocument();
  });

  it("shows the PCC compliance state for a police-character document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        requirementCode: "police_character",
        name: "Police Character Certificate",
        status: "verified",
        replacementAllowed: false,
        document: uploadedDocument({ issuedOn: "2026-08-01", expiresOn: "2027-02-01", complianceStatus: "near_expiry" }),
      }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Expiring soon/)).toBeInTheDocument();
  });

  it("clearly requests a new PCC and issue date once the current one has expired and replacement is allowed", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        requirementCode: "police_character",
        name: "Police Character Certificate",
        status: "verified",
        replacementAllowed: true,
        document: uploadedDocument({ issuedOn: "2025-01-01", expiresOn: "2025-07-01", complianceStatus: "expired" }),
      }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Expired/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    expect(await screen.findByLabelText("Police Character Certificate issue date")).toBeInTheDocument();
  });

  it("never renders a raw status or requirement code as text", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "unknown" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Status unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("passport", { exact: true })).not.toBeInTheDocument();
  });

  it("presents a View action for any document that has a file attached, so the candidate can always see what they submitted", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "verified", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("does not present a View action for a document with no file attached yet", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing", document: null })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });

  it("requests a signed URL on View, for the correct document id, and renders it as an Open document link, never eagerly fetching it on page load", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockResolvedValue({
      documentId: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      url: "/rails/active_storage/blobs/proxy/abc/passport.pdf",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(candidateDocumentsClient.requestDocumentAccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    const link = await screen.findByRole("link", { name: "Open document" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/rails/active_storage/blobs/proxy/abc/passport.pdf"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(candidateDocumentsClient.requestDocumentAccess).toHaveBeenCalledWith(
      "candidate-access-token",
      "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      undefined,
      "file-1"
    );
  });

  it("shows both Replace and View actions for a rejected document that still has an attached file", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument(), replacementAllowed: true }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.getByRole("button", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("shows a field error when the backend reports the document's attachment is missing after all", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockRejectedValue({
      code: "DOCUMENT_ATTACHMENT_MISSING",
      message: "The requested document file is unavailable.",
    });
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByText("The requested document file is unavailable.")).toBeInTheDocument();
  });

  it("ends the session and returns to sign-in when viewing a document fails because the session expired", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockRejectedValue({ code: "SESSION_EXPIRED" });
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(await screen.findByText("Login screen")).toBeInTheDocument();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "SESSION_EXPIRED" });
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    fireEvent.click(await screen.findByRole("button", { name: "Sign in again" }));
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Account inactive")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to sign in" }));
    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("shows an offline state with retry", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "OFFLINE" });
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries the checklist fetch after a network/server failure", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValueOnce({ code: "NETWORK_ERROR" }).mockResolvedValueOnce([item()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Passport")).toBeInTheDocument();
  });

  it("never sends a candidate id -- getChecklist is called only with the session access token", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(candidateDocumentsClient.getChecklist).toHaveBeenCalledWith("candidate-access-token");
  });

  it("renders in Urdu when the language is Urdu", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ name: "پاسپورٹ", status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    window.localStorage.setItem("descon.language", "ur");
    renderDocumentsPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(await screen.findByText("Go to documents"));

    expect(await screen.findByText("پاسپورٹ")).toBeInTheDocument();
  });

  describe("submit for review", () => {
    it("shows the submit action only when canSubmit is true", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
      await signInAndNavigateToDocuments();

      expect(await screen.findByRole("button", { name: "Submit for review" })).toBeInTheDocument();
    });

    it("does not show the submit action when canSubmit is false", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: false }) }));
      await signInAndNavigateToDocuments();

      await screen.findByText("Passport");
      expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
    });

    async function readyState() {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
      await signInAndNavigateToDocuments();
      fireEvent.click(await screen.findByRole("button", { name: "Submit for review" }));
    }

    it("opens a confirmation dialog before submitting", async () => {
      await readyState();
      expect(await screen.findByText("Submit documents for review?")).toBeInTheDocument();
      expect(applicationProgressClient.submitDocuments).not.toHaveBeenCalled();
    });

    it("submits on confirmation and closes the dialog", async () => {
      applicationProgressClient.submitDocuments.mockResolvedValue(submissionResult());
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());
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
      applicationProgressClient.submitDocuments.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(submissionResult());
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
      applicationProgressClient.submitDocuments.mockRejectedValueOnce({ code: "CONFLICT" }).mockResolvedValueOnce(submissionResult());
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("This submission could not be confirmed. Try submitting again.");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.queryByText("Submit documents for review?")).not.toBeInTheDocument());

      const [firstCall, secondCall] = applicationProgressClient.submitDocuments.mock.calls;
      expect(firstCall[0].idempotencyKey).not.toBe(secondCall[0].idempotencyKey);
    });

    it("ends the session and returns to sign-in on a 401 during submission", async () => {
      applicationProgressClient.submitDocuments.mockRejectedValue({ code: "SESSION_EXPIRED" });
      await readyState();
      await screen.findByText("Submit documents for review?");

      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("never sends a candidate id, assignment id, document id or requirement code when submitting", async () => {
      applicationProgressClient.submitDocuments.mockResolvedValue(submissionResult());
      await readyState();
      fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

      await waitFor(() => expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1));
      const call = applicationProgressClient.submitDocuments.mock.calls[0][0];
      expect(Object.keys(call).sort()).toEqual(["accessToken", "idempotencyKey"]);
    });
  });

  describe("uploading a missing document", () => {
    it("rejects an invalid file type client-side before ever calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(new File(["x"], "resume.docx", { type: "application/msword" }));

      expect(await screen.findByText("Upload a PDF, JPEG, or PNG file.")).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("rejects an empty file client-side", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile("empty.pdf", 0));

      expect(await screen.findByText("This file is empty.")).toBeInTheDocument();
    });

    it("accepts a valid PDF, shows an uploading state, then shows the updated document after success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
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
      await waitFor(() => expect(screen.getByText(/Uploaded/)).toBeInTheDocument());
      expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    });

    it("does not show a stale success toast or update the cache when the candidate logs out while an upload is still in flight", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      let resolveUpload;
      candidateDocumentsClient.uploadDocument.mockReturnValue(
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
      );
      await signInAndNavigateToDocumentsWithLogoutTrigger();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByText("Uploading…");

      const successSpy = vi.spyOn(toast, "success").mockClear();

      fireEvent.click(screen.getByText("test-logout-trigger"));
      resolveUpload(item({ status: "uploaded", document: uploadedDocument() }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(successSpy).not.toHaveBeenCalled();
      successSpy.mockRestore();
    });

    it("refreshes application progress after a successful upload, so Dashboard/Status next-action and counts don't go stale", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
      await signInAndNavigateToDocuments();

      await screen.findByText("Passport");
      const progressCallsBeforeUpload = applicationProgressClient.getProgress.mock.calls.length;

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() =>
        expect(applicationProgressClient.getProgress.mock.calls.length).toBeGreaterThan(progressCallsBeforeUpload)
      );
    });

    it("shows the selected file's type and size in Urdu when that is the persisted language", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      window.localStorage.setItem("descon.language", "ur");
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "اپ لوڈ کریں" }));
      selectFileOnActiveRow(pdfFile("passport.pdf", 1536));

      expect(await screen.findByText("منتخب فائل: passport.pdf • PDF • 1.5 KB")).toBeInTheDocument();
    });

    it("shows the selected file's type and size alongside its name", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile("passport.pdf", 1536));

      expect(await screen.findByText("Selected file: passport.pdf • PDF • 1.5 KB")).toBeInTheDocument();
    });

    it("shows a local preview for a selected image and revokes it when the file is replaced", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      vi.mocked(window.URL.createObjectURL).mockClear();
      vi.mocked(window.URL.revokeObjectURL).mockClear();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(imageFile("photo.jpg"));

      const preview = await screen.findByAltText("photo.jpg");
      expect(preview).toHaveAttribute("src", "blob:mock-preview-url");
      expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);

      selectFileOnActiveRow(pdfFile("passport.pdf"));

      await waitFor(() => expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-preview-url"));
      expect(screen.queryByAltText("photo.jpg")).not.toBeInTheDocument();
    });

    it("shows no preview for a non-image file", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());

      await screen.findByText(/Selected file: passport\.pdf/);
      expect(document.querySelector("img")).not.toBeInTheDocument();
    });

    it("does not show the PCC issue-date field for a non-PCC requirement", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      expect(screen.queryByLabelText("Police Character Certificate issue date")).not.toBeInTheDocument();
    });

    it("requires the PCC issue date before submitting, without calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      expect(screen.getByLabelText("Police Character Certificate issue date")).toBeInTheDocument();
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Enter the Police Character Certificate issue date.")).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("shows a validation error for a PCC issue date in an invalid format, without calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.change(screen.getByLabelText("Police Character Certificate issue date"), { target: { value: "26-08-2026" } });
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(
        await screen.findByText("Enter a valid Police Character Certificate issue date in YYYY-MM-DD format.")
      ).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("shows a validation error for a future PCC issue date, without calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.change(screen.getByLabelText("Police Character Certificate issue date"), { target: { value: "2099-01-01" } });
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("The Police Character Certificate issue date cannot be in the future.")).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("sends the PCC issue date as issued_on once it's valid", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(
        item({ requirementCode: "police_character", status: "uploaded", document: uploadedDocument() })
      );
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.change(screen.getByLabelText("Police Character Certificate issue date"), { target: { value: "2026-01-15" } });
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const [call] = candidateDocumentsClient.uploadDocument.mock.calls[0];
      expect(call.formData.get("candidate_document[issued_on]")).toBe("2026-01-15");
    });

    it("recalculates PCC compliance from the server's response after a successful replace", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({
          requirementCode: "police_character",
          name: "Police Character Certificate",
          status: "verified",
          document: uploadedDocument({ complianceStatus: "near_expiry" }),
        }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(
        item({
          requirementCode: "police_character",
          name: "Police Character Certificate",
          status: "uploaded",
          document: uploadedDocument({ complianceStatus: "current" }),
        })
      );
      await signInAndNavigateToDocuments();

      expect(await screen.findByText(/Expiring soon/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Replace" }));
      fireEvent.change(screen.getByLabelText("Police Character Certificate issue date"), { target: { value: "2026-08-01" } });
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.queryByText(/Expiring soon/)).not.toBeInTheDocument());
    });

    it("prevents duplicate submission while an upload is already in flight", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
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
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockReturnValue(new Promise(() => {}));
      await signInAndNavigateToDocuments();

      const uploadButtons = await screen.findAllByRole("button", { name: "Upload" });
      fireEvent.click(uploadButtons[0]);
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await screen.findByText("Uploading…");
      expect(screen.getAllByRole("button", { name: "Upload" })[1]).toBeDisabled();
    });

    it("allows removing the selected file and canceling before submission", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
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
      applicationProgressClient.getProgress.mockResolvedValue(progress());
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

    it("submits the exact multipart fields the backend expects", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
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
      // A single-file document sends one `files[]` entry with no part label.
      expect(call.formData.getAll("candidate_document[files][][file]")).toEqual([file]);
      expect(call.formData.getAll("candidate_document[files][][side_code]")).toEqual([]);
      expect(call.formData.get("candidate_document[file]")).toBeNull();
    });

    it("handles a 409 idempotency conflict safely, never as success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockRejectedValue({
        code: "CONFLICT",
        message: "The idempotency key does not match the original request.",
      });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("The idempotency key does not match the original request.")).toBeInTheDocument();
      expect(screen.queryByText(/Uploaded/)).not.toBeInTheDocument();
    });

    it("handles a 422 replacement_not_allowed by refreshing the checklist rather than retrying blindly", async () => {
      candidateDocumentsClient.getChecklist
        .mockResolvedValueOnce([item({ status: "rejected", document: uploadedDocument(), replacementAllowed: true })])
        .mockResolvedValueOnce([item({ status: "rejected", document: uploadedDocument(), replacementAllowed: false })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
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

    it("signs the candidate out when an upload fails because the session is confirmed expired", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "SESSION_EXPIRED" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("handles an offline upload failure with retry", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "OFFLINE" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileOnActiveRow(pdfFile());
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("You are offline")).toBeInTheDocument();
    });
  });

  describe("bank details", () => {
    it("shows Incomplete when no bank detail has been submitted", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      expect(await screen.findByText("Incomplete")).toBeInTheDocument();
    });

    it("shows Complete when a bank detail already exists", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateBankDetailsClient.getBankDetail.mockResolvedValue(bankDetailSummary({ status: "submitted", bankDetail: bankDetail() }));
      await signInAndNavigateToDocuments();

      expect(await screen.findByText("Complete")).toBeInTheDocument();
    });

    it("validates required fields client-side before calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Enter the account title.")).toBeInTheDocument();
      expect(screen.getByText("Enter the account number or IBAN.")).toBeInTheDocument();
      expect(screen.getByText("Enter the bank name.")).toBeInTheDocument();
      expect(candidateBankDetailsClient.submitBankDetail).not.toHaveBeenCalled();
    });

    it("rejects an invalid account number client-side, without calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.change(screen.getByLabelText("Account number / IBAN"), { target: { value: "!!" } });
      fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Meezan Bank" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Enter a valid account number or IBAN.")).toBeInTheDocument();
      expect(candidateBankDetailsClient.submitBankDetail).not.toHaveBeenCalled();
    });

    it("requires a proof file client-side before calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.change(screen.getByLabelText("Account number / IBAN"), { target: { value: "PK36SCBL0000001123456702" } });
      fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Meezan Bank" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Choose a file to upload.")).toBeInTheDocument();
      expect(candidateBankDetailsClient.submitBankDetail).not.toHaveBeenCalled();
    });

    it("submits the exact fields the backend expects and shows Complete after success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateBankDetailsClient.submitBankDetail.mockResolvedValue(bankDetailSummary({ status: "submitted", bankDetail: bankDetail() }));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.change(screen.getByLabelText("Account number / IBAN"), { target: { value: "PK36SCBL0000001123456702" } });
      fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Meezan Bank" } });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [pdfFile("cheque.pdf")] } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateBankDetailsClient.submitBankDetail).toHaveBeenCalledTimes(1));
      const [params] = candidateBankDetailsClient.submitBankDetail.mock.calls[0];
      expect(params.accessToken).toBe("candidate-access-token");
      expect(params.formData.get("bank_detail[account_title]")).toBe("Ahmed Ali");
      expect(params.formData.get("bank_detail[account_number]")).toBe("PK36SCBL0000001123456702");
      expect(params.formData.get("bank_detail[bank_name]")).toBe("Meezan Bank");
      expect(params.formData.get("bank_detail[proof]").name).toBe("cheque.pdf");

      expect(await screen.findByText("Complete")).toBeInTheDocument();
    });

    it("shows a field-addressable server error without closing the form", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateBankDetailsClient.submitBankDetail.mockRejectedValue({
        code: "INVALID_ACCOUNT_NUMBER",
        message: "Enter a valid account number or IBAN.",
        field: "bank_detail.account_number",
      });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.change(screen.getByLabelText("Account number / IBAN"), { target: { value: "PK36SCBL0000001123456702" } });
      fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Meezan Bank" } });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [pdfFile("cheque.pdf")] } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Enter a valid account number or IBAN.")).toBeInTheDocument();
      expect(screen.getByLabelText("Account title")).toBeInTheDocument();
    });

    it("ends the session and returns to sign-in when the bank-detail submission fails because the session expired", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateBankDetailsClient.submitBankDetail.mockRejectedValue({ code: "SESSION_EXPIRED" });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.change(screen.getByLabelText("Account number / IBAN"), { target: { value: "PK36SCBL0000001123456702" } });
      fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Meezan Bank" } });
      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [pdfFile("cheque.pdf")] } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
    });

    it("allows canceling the form without submitting", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.change(screen.getByLabelText("Account title"), { target: { value: "Ahmed Ali" } });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByLabelText("Account title")).not.toBeInTheDocument();
      expect(candidateBankDetailsClient.submitBankDetail).not.toHaveBeenCalled();
    });
  });
  describe("backend-driven multi-file documents", () => {
    const CNIC_RULES = {
      ...SINGLE_FILE_RULES,
      maximumFiles: 2,
      combinedPdfAllowed: true,
      allowedSideCodes: ["combined", "front", "back"],
    };
    const CERTIFICATE_RULES = { ...SINGLE_FILE_RULES, maximumFiles: 10, allowedSideCodes: ["certificate"] };

    function cnicItem(overrides = {}) {
      return item({
        requirementCode: "cnic",
        name: "CNIC",
        displayPosition: 2,
        instructions: "Upload the front and back of your CNIC.",
        uploadRules: CNIC_RULES,
        ...overrides,
      });
    }

    function selectFileForSlot(label, file) {
      const input = screen.getByLabelText(label, { selector: 'input[type="file"]' });
      fireEvent.change(input, { target: { files: [file] } });
    }

    it("renders the checklist in the backend's order with its instructions -- never re-sorted on the client", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "zz_last_alphabetically", name: "Medical Report", displayPosition: 1 }),
        cnicItem(),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      const names = (await screen.findAllByText(/^(Medical Report|CNIC)$/)).map((node) => node.textContent);
      expect(names).toEqual(["Medical Report", "CNIC"]);

      fireEvent.click(screen.getAllByRole("button", { name: "Upload" })[1]);
      expect(screen.getByText("Upload the front and back of your CNIC.")).toBeInTheDocument();
    });

    it("uploads CNIC front and back photos with their part labels, in order", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(cnicItem({ status: "uploaded", document: uploadedDocument() }));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      const front = imageFile("front.jpg");
      const back = imageFile("back.jpg");
      selectFileForSlot("Back", back);
      selectFileForSlot("Front", front);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const { formData } = candidateDocumentsClient.uploadDocument.mock.calls[0][0];
      expect(formData.getAll("candidate_document[files][][file]")).toEqual([front, back]);
      expect(formData.getAll("candidate_document[files][][side_code]")).toEqual(["front", "back"]);
    });

    it("blocks a CNIC upload with only the front side, explaining both parts are needed", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileForSlot("Front", imageFile("front.jpg"));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(
        await screen.findByText("Upload both parts of this document (front and back, or page 1 and page 2).")
      ).toBeInTheDocument();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("lets the candidate upload one combined PDF instead, labelled as combined", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(cnicItem({ status: "uploaded", document: uploadedDocument() }));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.click(screen.getByRole("button", { name: "One PDF with every page" }));
      const combined = pdfFile("cnic.pdf");
      selectFileForSlot("Combined PDF", combined);
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const { formData } = candidateDocumentsClient.uploadDocument.mock.calls[0][0];
      expect(formData.getAll("candidate_document[files][][file]")).toEqual([combined]);
      expect(formData.getAll("candidate_document[files][][side_code]")).toEqual(["combined"]);
    });

    it("collects several certificates under one requirement", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode: "educational_certificates", name: "Educational Certificates", uploadRules: CERTIFICATE_RULES }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      expect(screen.getByText("You can add up to 10 files.")).toBeInTheDocument();
      const first = pdfFile("matric.pdf");
      const second = pdfFile("degree.pdf");
      fireEvent.change(screen.getByLabelText("Add file", { selector: "input" }), { target: { files: [first, second] } });
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const { formData } = candidateDocumentsClient.uploadDocument.mock.calls[0][0];
      expect(formData.getAll("candidate_document[files][][file]")).toEqual([first, second]);
      expect(formData.getAll("candidate_document[files][][side_code]")).toEqual(["certificate", "certificate"]);
    });

    it("lists each file of an uploaded multi-file document with its own View action", async () => {
      const files = [
        { id: "file-front", sideCode: "front", position: 1, fileName: "front.jpg", contentType: "image/jpeg", fileSize: 10 },
        { id: "file-back", sideCode: "back", position: 2, fileName: "back.jpg", contentType: "image/jpeg", fileSize: 10 },
      ];
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        cnicItem({ status: "pending_review", replacementAllowed: false, document: uploadedDocument({ files }) }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.requestDocumentAccess.mockResolvedValue({
        documentId: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
        fileId: "file-back",
        url: "/rails/active_storage/blobs/proxy/abc/back.jpg",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await signInAndNavigateToDocuments();

      expect(await screen.findByText(/Front • front\.jpg/)).toBeInTheDocument();
      expect(screen.getByText(/Back • back\.jpg/)).toBeInTheDocument();
      fireEvent.click(screen.getAllByRole("button", { name: "View" })[1]);

      expect(await screen.findByRole("link", { name: "Open document" })).toHaveAttribute(
        "href",
        expect.stringContaining("back.jpg")
      );
      expect(candidateDocumentsClient.requestDocumentAccess).toHaveBeenCalledWith(
        "candidate-access-token",
        "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
        undefined,
        "file-back"
      );
    });

    it("explains a backend file-set rejection using its reason", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockRejectedValue({
        code: "INVALID_DOCUMENT_FILES",
        reason: "duplicate_side_code",
        message: "Each part can only be uploaded once.",
      });
      await signInAndNavigateToDocuments();

      fireEvent.click(await screen.findByRole("button", { name: "Upload" }));
      selectFileForSlot("Front", imageFile("front.jpg"));
      selectFileForSlot("Back", imageFile("back.jpg"));
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Each part of this document can only be uploaded once.")).toBeInTheDocument();
    });
  });
});
