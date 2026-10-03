import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Image, Linking, Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { AuthProvider, useAuth } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateDocumentsClient } from "../../../lib/candidate-documents-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { candidateBankDetailsClient } from "../../../lib/candidate-bank-details-client";
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
        consent: { currentPolicyVersion: "v1", accepted: true, acceptedAt: "2026-09-06T12:00:00Z" },
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
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("../../../lib/candidate-documents-client", () => ({
  candidateDocumentsClient: { getChecklist: jest.fn(), uploadDocument: jest.fn(), requestDocumentAccess: jest.fn() },
}));
jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));
jest.mock("../../../lib/candidate-bank-details-client", () => ({
  candidateBankDetailsClient: { getBankDetail: jest.fn(), submitBankDetail: jest.fn() },
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
    uploadedAt: "2026-08-26T12:00:00Z",
    rejectionReason: null,
    complianceStatus: "not_applicable",
    files: [{ id: "file-1", sideCode: null, position: 1, fileName: "passport.pdf", contentType: "application/pdf", fileSize: 1024 }],
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

function imagePickerAsset(overrides = {}) {
  return {
    uri: "file:///tmp/photo.jpg",
    fileName: "photo.jpg",
    fileSize: 2048,
    mimeType: "image/jpeg",
    ...overrides,
  };
}

function grantedPermission() {
  return { status: "granted", granted: true, canAskAgain: true, expires: "never" };
}

function deniedPermission(canAskAgain) {
  return { status: "denied", granted: false, canAskAgain, expires: "never" };
}

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

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

// BankDetailsPanel unconditionally queries bank-detail state as soon as it
// mounts -- default it to the "missing" state here so the pre-existing
// tests below (none of which are about bank details) don't each need their
// own mock, mirroring web's identical page.test.jsx convention.
beforeEach(() => {
  candidateBankDetailsClient.getBankDetail.mockResolvedValue(bankDetailSummary());
});

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateDocumentsClient.getChecklist).mockReset();
  jest.mocked(candidateDocumentsClient.uploadDocument).mockReset();
  jest.mocked(candidateDocumentsClient.requestDocumentAccess).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  jest.mocked(applicationProgressClient.submitDocuments).mockReset();
  jest.mocked(candidateBankDetailsClient.getBankDetail).mockReset();
  jest.mocked(candidateBankDetailsClient.submitBankDetail).mockReset();
  jest.mocked(DocumentPicker.getDocumentAsync).mockReset();
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockReset();
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReset();
  jest.mocked(ImagePicker.launchCameraAsync).mockReset();
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
  mockReplace.mockReset();
  // Two tests below persist "ur" via AsyncStorage (there's no in-memory
  // LanguageContext reset between tests the way web's localStorage-cleanup
  // afterEach handles) -- without removing it here, every test running
  // after either of them in file order silently renders in Urdu instead of
  // the English strings it actually asserts on.
  const AsyncStorage = require("@react-native-async-storage/async-storage");
  await AsyncStorage.removeItem("descon.language");
});

/** Test-only harness: mounted alongside DocumentsScreen inside the same AuthProvider so a test can end the session mid-flight, mirroring how a real logout could race an in-flight upload's response. */
function LogoutTrigger() {
  const { logout } = useAuth();
  return <Text onPress={() => logout()}>test-logout-trigger</Text>;
}

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

    // This is the first test in the file to mount DocumentsScreen, so it's
    // also the first to pay for useFonts' async load and AuthProvider's
    // SecureStore restore -- a slower/loaded CI runner can push that past
    // findByText's default ~1s timeout even though nothing here is
    // otherwise racy (getChecklist deliberately never resolves). A longer,
    // explicit timeout only widens the window; it doesn't change what's
    // being asserted.
    expect(await screen.findByText("Loading…", {}, { timeout: 5000 })).toBeOnTheScreen();
  });

  it("shows an empty state, not zeroed stat tiles, when the checklist has no requirements", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([]);
    applicationProgressClient.getProgress.mockResolvedValue(progress({ documents: documentsSummary({ requiredTotal: 0 }) }));
    renderDocumentsScreen();

    expect(await screen.findByText("No documents required")).toBeOnTheScreen();
    expect(screen.getByText("There is nothing to upload right now.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();
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

  it("does not show an expandable View/Download row for a document with no file attached yet", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing", document: null })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
  });

  it("expands a view-only document row on tap to reveal View and Download actions, collapsing on a second tap", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Passport" }));

    expect(await screen.findByRole("button", { name: "View" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Download" })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "View" })).toBeNull());
  });

  it("requests a signed URL on View and hands it to the OS via Linking.openURL, for a document with no other action", async () => {
    const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockResolvedValue({
      documentId: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      url: "/rails/active_storage/blobs/proxy/abc/passport.pdf",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
    renderDocumentsScreen();

    await screen.findByText("Passport");
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "View" }));
    });

    await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
    expect(candidateDocumentsClient.requestDocumentAccess).toHaveBeenCalledWith(
      "candidate-access-token",
      "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      "inline",
      "file-1"
    );
    expect(openURL.mock.calls[0][0]).toContain("/rails/active_storage/blobs/proxy/abc/passport.pdf");
    openURL.mockRestore();
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  });

  it("requests an attachment-disposition signed URL on Download", async () => {
    const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockResolvedValue({
      documentId: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      url: "/rails/active_storage/blobs/proxy/abc/passport.pdf?disposition=attachment",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
    renderDocumentsScreen();

    await screen.findByText("Passport");
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "Download" }));
    });

    await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
    expect(candidateDocumentsClient.requestDocumentAccess).toHaveBeenCalledWith(
      "candidate-access-token",
      "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      "attachment",
      "file-1"
    );
    openURL.mockRestore();
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  });

  it("reveals view/download and replacement only after expanding a rejected card", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument({ rejectionReason: "Photo is blurry." }), replacementAllowed: true }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Passport");
    expect(screen.queryByText("Replace")).toBeNull();
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    expect(screen.getByRole("button", { name: "Passport" }).props.accessibilityState.expanded).toBe(true);
    expect(screen.getByRole("button", { name: "Replace" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Choose file" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Replace" }));
    expect(screen.getByRole("button", { name: "Choose file" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "View" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Download" })).toBeOnTheScreen();
  });

  it("shows a generic error and never calls Linking.openURL when the signed URL does not resolve to our own API origin (fails closed)", async () => {
    const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockResolvedValue({
      documentId: "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
      url: "https://evil.example/passport.pdf",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue();
    renderDocumentsScreen();

    await screen.findByText("Passport");
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "View" }));
    });

    expect(await screen.findByText("Something went wrong.")).toBeOnTheScreen();
    expect(openURL).not.toHaveBeenCalled();
    openURL.mockRestore();
    process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  });

  it("shows the specific error inside the expanded panel when the backend reports the document's attachment is missing", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockRejectedValue({
      code: "DOCUMENT_ATTACHMENT_MISSING",
      message: "The requested document file is unavailable.",
    });
    renderDocumentsScreen();

    await screen.findByText("Passport");
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "View" }));
    });

    expect(await screen.findByText("The requested document file is unavailable.")).toBeOnTheScreen();
  });

  it("ends the session and returns to sign-in when viewing a document fails because the session expired", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "verified", document: uploadedDocument(), replacementAllowed: false }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    candidateDocumentsClient.requestDocumentAccess.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderDocumentsScreen();

    await screen.findByText("Passport");
    fireEvent.press(screen.getByRole("button", { name: "Passport" }));
    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "View" }));
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows the rejection reason for a rejected document", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ status: "rejected", document: uploadedDocument({ rejectionReason: "Photo is blurry." }) }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText("Photo is blurry.")).toBeOnTheScreen();
  });

  it("shows the PCC compliance state for a police-character document nearing expiry", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        requirementCode: "police_character",
        name: "Police Character Certificate",
        status: "verified",
        replacementAllowed: false,
        document: uploadedDocument({ complianceStatus: "near_expiry" }),
      }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText(/Expiring soon/)).toBeOnTheScreen();
  });

  it("clearly requests a new PCC and issue date once the current one has expired and replacement is allowed", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({
        requirementCode: "police_character",
        name: "Police Character Certificate",
        status: "verified",
        replacementAllowed: true,
        document: uploadedDocument({ complianceStatus: "expired" }),
      }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    expect(await screen.findByText(/Expired/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Police Character Certificate" }));
    fireEvent.press(screen.getByRole("button", { name: "Replace" }));

    expect(await screen.findByLabelText("Police Character Certificate issue date")).toBeOnTheScreen();
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

  it("refreshes application progress after a successful upload, so Dashboard/Status next-action and counts don't go stale", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
    renderDocumentsScreen();

    await screen.findByText("Passport");
    const progressCallsBeforeUpload = applicationProgressClient.getProgress.mock.calls.length;

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    });

    await waitFor(() =>
      expect(applicationProgressClient.getProgress.mock.calls.length).toBeGreaterThan(progressCallsBeforeUpload)
    );
  });

  it("does not show a stale success toast or update the cache when the candidate logs out while an upload is still in flight", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    let resolveUpload;
    candidateDocumentsClient.uploadDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    const queryClient = createTestQueryClient();
    trackRender(
      render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <AuthProvider>
                <DocumentsScreen />
                <LogoutTrigger />
              </AuthProvider>
            </LanguageProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      )
    );

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Uploading…");

    const { toast } = require("sonner-native");
    jest.mocked(toast.success).mockClear();

    await act(async () => {
      fireEvent.press(screen.getByText("test-logout-trigger"));
    });

    await act(async () => {
      resolveUpload(item({ status: "uploaded", document: uploadedDocument() }));
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the selected file's type and size alongside its name", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset("passport.pdf", 1536)] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));

    expect(await screen.findByText("Selected file: passport.pdf • PDF • 1.5 KB")).toBeOnTheScreen();
  });

  it("takes a photo with the camera once permission is granted, showing a local preview before upload", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(grantedPermission());
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [imagePickerAsset()] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });

    expect(await screen.findByText(/Selected file: photo\.jpg • JPEG/)).toBeOnTheScreen();
    expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: "file:///tmp/photo.jpg" });
  });

  it("chooses an image from the gallery once permission is granted", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue(grantedPermission());
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [imagePickerAsset({ fileName: "gallery.png", mimeType: "image/png" })] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Choose from gallery" }));
    });

    expect(await screen.findByText(/Selected file: gallery\.png • PNG/)).toBeOnTheScreen();
  });

  it("silently ignores a cancelled document/file pick, showing no error", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Choose file" }));
    });

    expect(screen.getByText("No file chosen")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("silently ignores a cancelled camera capture, showing no error", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(grantedPermission());
    ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });

    expect(screen.getByText("No file chosen")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("silently ignores a cancelled gallery pick, showing no error", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue(grantedPermission());
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Choose from gallery" }));
    });

    expect(screen.getByText("No file chosen")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows recoverable guidance when camera permission is denied but can be asked again, never launching the camera", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(deniedPermission(true));
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });

    expect(await screen.findByText("Allow camera access to take a photo, or choose a file instead.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Open Settings" })).toBeNull();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("shows an Open Settings action when camera permission is permanently blocked, and opens device settings", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(deniedPermission(false));
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });

    expect(await screen.findByText("Camera access is turned off for this app. Open Settings to allow it, or choose a file instead.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
    expect(openSettings).toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it("shows an Open Settings action when photo library permission is permanently blocked", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue(deniedPermission(false));
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Choose from gallery" }));
    });

    expect(
      await screen.findByText("Photo access is turned off for this app. Open Settings to allow it, or choose a file instead.")
    ).toBeOnTheScreen();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("still allows choosing a file from the document picker when camera access is unavailable", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(deniedPermission(false));
    DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset()] });
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Take photo" }));
    });
    await screen.findByText("Camera access is turned off for this app. Open Settings to allow it, or choose a file instead.");

    fireEvent.press(screen.getByRole("button", { name: "Choose file" }));
    await screen.findByText(/Selected file: passport\.pdf/);
  });

  it.each([
    ["a PDF-only requirement", ["application/pdf"]],
  ])(
    "hides camera/gallery capture for %s, offering only Choose file -- decided by the backend's accepted types",
    async (_label, acceptedContentTypes) => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({
          requirementCode: "cv",
          name: "CV / Resume",
          status: "missing",
          uploadRules: { ...SINGLE_FILE_RULES, acceptedContentTypes },
        }),
      ]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));

      expect(screen.queryByRole("button", { name: "Take photo" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Choose from gallery" })).toBeNull();
      expect(screen.queryByText("Make sure the whole document is visible, right-side up and not cropped.")).toBeNull();
      expect(screen.getByRole("button", { name: "Choose file" })).toBeOnTheScreen();
    }
  );

  it("still shows camera/gallery capture for a physical document like the police character certificate", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([
      item({ requirementCode: "police_character", name: "Police Character Certificate", status: "missing" }),
    ]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Upload" }));

    expect(screen.getByRole("button", { name: "Take photo" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Choose from gallery" })).toBeOnTheScreen();
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

  it("renders the capture buttons, guidance and a permission-blocked notice in Urdu", async () => {
    candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue(deniedPermission(false));
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderDocumentsScreen();

    fireEvent.press(await screen.findByRole("button", { name: "اپ لوڈ کریں" }));
    expect(screen.getByRole("button", { name: "تصویر لیں" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "گیلری سے منتخب کریں" })).toBeOnTheScreen();
    expect(screen.getByText("یقینی بنائیں کہ پوری دستاویز نظر آ رہی ہے، سیدھی ہے اور کٹی ہوئی نہیں۔")).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "تصویر لیں" }));
    });

    expect(
      await screen.findByText("اس ایپ کے لیے کیمرے تک رسائی بند ہے۔ اسے اجازت دینے کے لیے ترتیبات کھولیں، یا اس کے بجائے فائل منتخب کریں۔")
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "ترتیبات کھولیں" })).toBeOnTheScreen();
  });

  describe("bank details", () => {
    it("shows Incomplete when no bank detail has been submitted", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDocumentsScreen();

      expect(await screen.findByText("Incomplete")).toBeOnTheScreen();
    });

    it("shows Complete when a bank detail already exists", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateBankDetailsClient.getBankDetail.mockResolvedValue(bankDetailSummary({ status: "submitted", bankDetail: bankDetail() }));
      renderDocumentsScreen();

      expect(await screen.findByText("Complete")).toBeOnTheScreen();
    });

    it("validates required fields client-side before calling the API", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));

      expect(await screen.findByText("Enter the account title.")).toBeOnTheScreen();
      expect(screen.getByText("Enter the account number or IBAN.")).toBeOnTheScreen();
      expect(screen.getByText("Enter the bank name.")).toBeOnTheScreen();
      expect(candidateBankDetailsClient.submitBankDetail).not.toHaveBeenCalled();
    });

    it("picks a proof file, submits and shows Complete after success", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset("cheque.pdf")] });
      candidateBankDetailsClient.submitBankDetail.mockResolvedValue(bankDetailSummary({ status: "submitted", bankDetail: bankDetail() }));
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.changeText(screen.getByLabelText("Account title"), "Ahmed Ali");
      fireEvent.changeText(screen.getByLabelText("Account number / IBAN"), "PK36SCBL0000001123456702");
      fireEvent.changeText(screen.getByLabelText("Bank name"), "Meezan Bank");
      fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
      await screen.findByText(/Selected file: cheque\.pdf/);

      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "Submit" }));
      });

      await waitFor(() => expect(candidateBankDetailsClient.submitBankDetail).toHaveBeenCalledTimes(1));
      const [params] = candidateBankDetailsClient.submitBankDetail.mock.calls[0];
      expect(params.accessToken).toBe("candidate-access-token");
      expect(params.formData.get("bank_detail[account_title]")).toBe("Ahmed Ali");
      expect(params.formData.get("bank_detail[account_number]")).toBe("PK36SCBL0000001123456702");
      expect(params.formData.get("bank_detail[bank_name]")).toBe("Meezan Bank");

      expect(await screen.findByText("Complete")).toBeOnTheScreen();
    });

    it("ends the session and returns to sign-in when the bank-detail submission fails because the session expired", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([item({ status: "missing" })]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      DocumentPicker.getDocumentAsync.mockResolvedValue({ canceled: false, assets: [pdfAsset("cheque.pdf")] });
      candidateBankDetailsClient.submitBankDetail.mockRejectedValue({ code: "SESSION_EXPIRED" });
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add bank details" }));
      fireEvent.changeText(screen.getByLabelText("Account title"), "Ahmed Ali");
      fireEvent.changeText(screen.getByLabelText("Account number / IBAN"), "PK36SCBL0000001123456702");
      fireEvent.changeText(screen.getByLabelText("Bank name"), "Meezan Bank");
      fireEvent.press(await screen.findByRole("button", { name: "Choose file" }));
      await screen.findByText(/Selected file: cheque\.pdf/);
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    });
  });
  it("shows every common requirement alongside country-specific documents, in backend order", async () => {
    const names = ["Passport", "CNIC", "Photograph", "Next of kin CNIC", "CV", "Educational certificates", "Experience certificates", "Cheque copy", "Country medical report"];
    const codes = ["passport", "cnic", "photograph", "next_of_kin_cnic", "cv", "educational_certificates", "experience_certificates", "cheque_copy", "gamca_medical_report"];
    candidateDocumentsClient.getChecklist.mockResolvedValue(names.map((name, index) => item({ name, requirementCode: codes[index], displayPosition: index + 1, required: index !== 5 })));
    applicationProgressClient.getProgress.mockResolvedValue(progress());
    renderDocumentsScreen();

    await screen.findByText("Country medical report");
    names.forEach(name => expect(screen.getByText(name === "Photograph" ? "Photo" : name)).toBeOnTheScreen());
    expect(screen.getAllByRole("button", { name: "Upload" })).toHaveLength(9);
    fireEvent.press(screen.getAllByRole("button", { name: "Upload" })[5]);
    expect(screen.getByRole("button", { name: "Choose file" })).toBeOnTheScreen();
  });

  describe("passport upload modes", () => {
    const passport = () => item({ uploadRules: { ...SINGLE_FILE_RULES, maximumFiles: 2, combinedPdfAllowed: true, allowedSideCodes: ["combined", "page_1", "page_2"] } });

    it("switches from a single PDF to two separate page files and uploads both labels", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([passport()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
      renderDocumentsScreen();
      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
      expect(screen.getByText("Combined PDF")).toBeOnTheScreen();
      expect(screen.getByText("Upload one scanned PDF containing both pages or sides.")).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "Separate photos" }));
      expect(screen.getByText("Page 1")).toBeOnTheScreen();
      expect(screen.getByText("Page 2")).toBeOnTheScreen();
      expect(screen.getByText("Upload each page or side separately in the two slots below.")).toBeOnTheScreen();
      expect(screen.queryByText("Upload one scanned PDF containing both pages or sides.")).toBeNull();
      expect(screen.queryByText("Combined PDF")).toBeNull();
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdfAsset("page1.pdf")] });
      fireEvent.press(screen.getAllByRole("button", { name: "Choose file" })[0]);
      await screen.findByText(/Selected file: page1\.pdf/);
      // Tapping the selected mode must not discard a selected page.
      fireEvent.press(screen.getByRole("button", { name: "Separate photos" }));
      expect(screen.getByText(/Selected file: page1\.pdf/)).toBeOnTheScreen();
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [imagePickerAsset({ name: "page2.jpg", uri: "file:///tmp/page2.jpg", size: 2048, mimeType: "image/jpeg" })] });
      fireEvent.press(screen.getAllByRole("button", { name: "Choose file" })[0]);
      await screen.findByText(/Selected file: page2\.jpg/);
      const appendSpy = jest.spyOn(FormData.prototype, "append");
      await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Submit" })); });
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      expect(appendSpy.mock.calls.filter(([key]) => key === "candidate_document[files][][side_code]").map(([, value]) => value)).toEqual(["page_1", "page_2"]);
      appendSpy.mockRestore();
    });

    it("switches back to one scanned PDF and submits it as combined", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([passport()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(item({ status: "uploaded", document: uploadedDocument() }));
      renderDocumentsScreen();
      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.press(screen.getByRole("button", { name: "Separate photos" }));
      fireEvent.press(screen.getByRole("button", { name: "One PDF with every page" }));
      expect(screen.queryByText("Page 1")).toBeNull();
      expect(screen.getAllByRole("button", { name: "Choose file" })).toHaveLength(1);
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [pdfAsset("passport-scan.pdf")] });
      fireEvent.press(screen.getByRole("button", { name: "Choose file" }));
      await screen.findByText(/Selected file: passport-scan\.pdf/);
      const appendSpy = jest.spyOn(FormData.prototype, "append");
      await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Submit" })); });
      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      expect(appendSpy.mock.calls.filter(([key]) => key === "candidate_document[files][][side_code]").map(([, value]) => value)).toEqual(["combined"]);
      appendSpy.mockRestore();
    });
  });

  describe("backend-driven multi-file documents", () => {
    const CNIC_RULES = {
      ...SINGLE_FILE_RULES,
      maximumFiles: 2,
      combinedPdfAllowed: true,
      allowedSideCodes: ["combined", "front", "back"],
    };

    function cnicItem(overrides = {}) {
      return item({
        requirementCode: "cnic",
        name: "CNIC",
        instructions: "Upload the front and back of your CNIC.",
        uploadRules: CNIC_RULES,
        ...overrides,
      });
    }

    function imageAsset(name) {
      return { uri: `file:///tmp/${name}`, name, size: 2048, mimeType: "image/jpeg", lastModified: 1_700_000_000_000 };
    }

    async function chooseFileForNextEmptySlot(asset) {
      DocumentPicker.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [asset] });
      fireEvent.press(screen.getAllByRole("button", { name: "Choose file" })[0]);
      await screen.findByText(new RegExp(`Selected file: ${asset.name.replace(".", "\\.")}`));
    }

    it("shows the backend instructions and labelled front/back slots, sending both parts with their labels", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      candidateDocumentsClient.uploadDocument.mockResolvedValue(cnicItem({ status: "uploaded", document: uploadedDocument() }));
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
      expect(screen.getByText("Upload the front and back of your CNIC.")).toBeOnTheScreen();
      expect(screen.getByText("Front")).toBeOnTheScreen();
      expect(screen.getByText("Back")).toBeOnTheScreen();

      await chooseFileForNextEmptySlot(imageAsset("front.jpg"));
      await chooseFileForNextEmptySlot(imageAsset("back.jpg"));
      const appendSpy = jest.spyOn(FormData.prototype, "append");
      await act(async () => {
        fireEvent.press(screen.getByRole("button", { name: "Submit" }));
      });

      await waitFor(() => expect(candidateDocumentsClient.uploadDocument).toHaveBeenCalledTimes(1));
      const labels = appendSpy.mock.calls.filter(([key]) => key === "candidate_document[files][][side_code]").map(([, value]) => value);
      const names = appendSpy.mock.calls.filter(([key]) => key === "candidate_document[files][][file]").map(([, part]) => part.name);
      appendSpy.mockRestore();
      expect(labels).toEqual(["front", "back"]);
      expect(names).toEqual(["front.jpg", "back.jpg"]);
    });

    it("blocks a CNIC upload with only the front side, explaining both parts are needed", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
      await chooseFileForNextEmptySlot(imageAsset("front.jpg"));
      fireEvent.press(screen.getByRole("button", { name: "Submit" }));

      expect(
        await screen.findByText("Upload both parts of this document (front and back, or page 1 and page 2).")
      ).toBeOnTheScreen();
      expect(candidateDocumentsClient.uploadDocument).not.toHaveBeenCalled();
    });

    it("offers one combined PDF instead, without photo capture for it", async () => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([cnicItem()]);
      applicationProgressClient.getProgress.mockResolvedValue(progress());
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Upload" }));
      fireEvent.press(screen.getByRole("button", { name: "One PDF with every page" }));

      expect(screen.getByText("Combined PDF")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Take photo" })).toBeNull();
      expect(screen.getAllByRole("button", { name: "Choose file" })).toHaveLength(1);
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
      const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
      const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      renderDocumentsScreen();

      fireEvent.press(await screen.findByRole("button", { name: "CNIC" }));
      expect(screen.getByText(/Front • front\.jpg/)).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "View" }));
      const fileActions = await screen.findAllByRole("button", { name: "View" });
      const backAction = fileActions[2];
      expect(screen.queryByText("View Back • back.jpg")).toBeNull();
      await act(async () => {
        fireEvent.press(backAction);
      });

      await waitFor(() => expect(openURL).toHaveBeenCalledTimes(1));
      expect(candidateDocumentsClient.requestDocumentAccess).toHaveBeenCalledWith(
        "candidate-access-token",
        "30fcedd6-7fe6-4d12-a5ae-f6b5ef3d91dd",
        "inline",
        "file-back"
      );
      openURL.mockRestore();
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    });
  });
});
