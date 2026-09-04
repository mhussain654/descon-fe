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
  candidateDocumentsClient: { getChecklist: jest.fn(), uploadDocument: jest.fn() },
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

  it.each(["cv", "experience_letter", "certificates"])(
    "hides camera/gallery capture for the %s requirement, offering only Choose file",
    async (requirementCode) => {
      candidateDocumentsClient.getChecklist.mockResolvedValue([
        item({ requirementCode, name: "CV / Resume", status: "missing" }),
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
});
