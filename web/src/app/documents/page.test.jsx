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
  afterEach(() => {
    vi.mocked(candidateDocumentsClient.getChecklist).mockReset();
    vi.mocked(candidateDocumentsClient.uploadDocument).mockReset();
    vi.mocked(applicationProgressClient.getProgress).mockReset();
    vi.mocked(applicationProgressClient.submitDocuments).mockReset();
    window.localStorage.removeItem("descon.language");
  });

  it("shows a loading state before the checklist resolves", async () => {
    candidateDocumentsClient.getChecklist.mockReturnValue(new Promise(() => {}));
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
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

  it("never renders a raw status or requirement code as text", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "unknown" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    expect(await screen.findByText(/Status unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("passport", { exact: true })).not.toBeInTheDocument();
  });

  it("never presents a download or preview action for any document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "verified", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    await signInAndNavigateToDocuments();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /preview/i })).not.toBeInTheDocument();
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
      expect(call.formData.get("candidate_document[file]")).toBe(file);
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
});
