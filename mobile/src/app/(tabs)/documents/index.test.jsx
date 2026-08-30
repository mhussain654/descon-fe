import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateDocumentsClient } from "../../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import DocumentsScreen from "./index";

// Matches design-system/toast.test.ts's own mock -- without it, toast.success()
// throws "ToastContext is not initialized" (no <Toaster/> is mounted here),
// which was silently aborting the rest of useSubmitDocuments' onSuccess
// callback before it ever reached setConfirmOpen(false).
jest.mock("sonner-native", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn(), dismiss: jest.fn() },
  Toaster: () => null,
}));

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...args) => mockReplace(...args), push: jest.fn(), back: jest.fn() }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() =>
    Promise.resolve(
      JSON.stringify({
        accessToken: "candidate-access-token",
        refreshToken: "refresh",
        candidateId: "candidate-public-id-1",
        candidateName: "Ahmed Ali",
        preferredLocale: "en",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      })
    )
  ),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@react-navigation/native", () => ({ useFocusEffect: () => {} }));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

jest.mock("../../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: jest.fn(), uploadDocument: jest.fn() },
}));
jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
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
    uploadedAt: "2026-08-26T12:00:00Z",
    rejectionReason: null,
    complianceStatus: "not_applicable",
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

function pdfAsset(name = "passport.pdf", size = 1024) {
  return {
    uri: `file:///tmp/${name}`,
    name,
    size,
    mimeType: "application/pdf",
    lastModified: 1_700_000_000_000,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateDocumentsClient.getChecklist).mockReset();
  jest.mocked(candidateDocumentsClient.uploadDocument).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  jest.mocked(applicationProgressClient.submitDocuments).mockReset();
  jest.mocked(DocumentPicker.getDocumentAsync).mockReset();
  mockReplace.mockReset();
});

function renderDocumentsScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <DocumentsScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe("DocumentsScreen", () => {
  it("shows a loading state before the checklist resolves", async () => {
    candidateDocumentsClient.getChecklist.mockReturnValue(new Promise(() => {}));
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  });

  it("shows the verified/pending/missing stat tiles from real progress counts", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item()]);
    applicationProgressClient.getProgress.mockResolvedValue(
      progress({ documents: documentsSummary({ verified: 2, pendingReview: 1, missing: 3 }) })
    );
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.getByText("2")).toBeOnTheScreen();
    expect(screen.getByText("1")).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
  });

  it("renders a required missing document with an Upload action", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing", required: true })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.getByText("Pending • Required")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Upload" })).toBeOnTheScreen();
  });

  it("renders a verified document with no upload/replace action when replacement isn't allowed", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace" })).toBeNull();
  });

  it("shows the rejection reason for a rejected document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument({ rejectionReason: "Photo is blurry." }) }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("Photo is blurry.")).toBeOnTheScreen();
  });

  it("shows a submit-for-review button only when the backend reports canSubmit", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
    renderDocumentsScreen();

    expect(await screen.findByRole("button", { name: "Submit for review" })).toBeOnTheScreen();
  });

  it("does not show a submit-for-review button when the backend reports canSubmit as false", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });

  it("submits the checklist for review after confirming", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
    applicationProgressClient.submitDocuments.mockResolvedValue(submissionResult());
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Submit for review" }));
    await screen.findByText("Submit documents for review?");
    // A bare `fireEvent.press` here starts the mutation but doesn't await the
    // microtask chain that resolves it (mutationFn -> onSuccess ->
    // setConfirmOpen(false)) -- without wrapping it in `act`, React defers
    // committing that state update to a low-priority scheduling lane that
    // the react-test-renderer takes ~3s to flush on its own, well past the
    // `waitFor` below's default 1s timeout, even though the dialog's own
    // state closes correctly and near-instantly in the real app. Wrapping
    // the press in `act(async () => ...)` flushes that chain immediately.
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    });

    await waitFor(() => expect(screen.queryByText("Submit documents for review?")).toBeNull());
    expect(applicationProgressClient.submitDocuments).toHaveBeenCalledTimes(1);
  });

  it("ends the session and returns to sign-in on a session-expired error during submission", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "uploaded", document: uploadedDocument() })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ canSubmit: true }) }));
    applicationProgressClient.submitDocuments.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Submit for review" }));
    await screen.findByText("Submit documents for review?");
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("picks, validates and uploads a missing document, replacing the row with the server's response", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    let resolveUpload;
    candidateDocumentsClient.uploadDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Uploading…")).toBeOnTheScreen();

    resolveUpload(item({ status: "uploaded", document: uploadedDocument() }));
    await waitFor(() => expect(screen.getByText(/Uploaded/)).toBeOnTheScreen());
    expect(screen.queryByText("Submit")).toBeNull();
  });

  it("does not show the PCC issue-date field for a non-PCC requirement", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    expect(screen.queryByLabelText("Police Character Certificate issue date")).toBeNull();
  });

  it("requires the PCC issue date before submitting, without calling the API", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    expect(screen.getByLabelText("Police Character Certificate issue date")).toBeOnTheScreen();
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Enter the Police Character Certificate issue date.")).toBeOnTheScreen();
    expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
  });

  it("shows a validation error for a PCC issue date in an invalid format, without calling the API", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.changeText(screen.getByLabelText("Police Character Certificate issue date"), "26-08-2026");
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Enter a valid Police Character Certificate issue date in YYYY-MM-DD format.")
    ).toBeOnTheScreen();
    expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
  });

  it("shows a validation error for a future PCC issue date, without calling the API", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.changeText(screen.getByLabelText("Police Character Certificate issue date"), "2099-01-01");
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("The Police Character Certificate issue date cannot be in the future.")).toBeOnTheScreen();
    expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
  });

  it("sends the PCC issue date as issued_on once it's valid", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    candidateDocumentsClient.uploadDocument.mockResolvedValue(
      item({ requirementCode: "police_character", status: "uploaded", document: uploadedDocument() })
    );
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.changeText(screen.getByLabelText("Police Character Certificate issue date"), "2026-01-15");
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    // Wrapped in act() -- see "submits the checklist for review after
    // confirming"'s comment for why: the mutation's success callback runs
    // outside a synchronous event handler, and without this the react-test-
    // renderer defers the resulting state update to a low-priority
    // scheduling lane instead of committing it (and warns accordingly).
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    });

    await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
    const [call] = candidateDocumentsClient.uploadDocument.mock.calls[0];
    expect(call.formData.get("candidate_document[issued_on]")).toBe("2026-01-15");
  });

  it("ends the session and returns to sign-in on a session-expired error during upload", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    candidateDocumentsClient.uploadDocument.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("disables other rows' upload/replace actions while one upload is pending", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "passport", status: "missing" }),
      item({ requirementCode: "cnic_front", name: "CNIC", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    candidateDocumentsClient.uploadDocument.mockReturnValue(new Promise(() => {}));
    renderDocumentsScreen();

    const uploadButtons = await screen.findAllByRole("button", { name: "Upload" });
    fireEvent.press(uploadButtons[0]);
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Uploading…");
    expect(screen.getAllByRole("button", { name: "Upload" })[1]).toBeDisabled();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "SESSION_EXPIRED" });
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a distinct inactive-account state", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
  });

  it("shows an offline state with a retry action", async () => {
    candidateDocumentsClient.getChecklist.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce([item()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Passport");
  });

  it("renders in Urdu when that is the persisted language", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item()]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderDocumentsScreen();

    expect(await screen.findByText("زیر التواء • لازمی")).toBeOnTheScreen();
  });
});
