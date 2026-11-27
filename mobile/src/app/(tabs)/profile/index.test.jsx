import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { candidateProfileClient } from "../../../lib/candidate-profile-client";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import ProfileScreen from "./index";

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
const mockSetScheme = jest.fn(() => Promise.resolve());
jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => ({ scheme: "light", setScheme: mockSetScheme }),
}));
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

jest.mock("../../../lib/candidate-profile-client", () => ({
  candidateProfileClient: { getProfile: jest.fn(), updateEmail: jest.fn() },
}));
jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));

function profilePayload(overrides = {}) {
  return {
    id: "candidate-public-id-1",
    fullName: "Ahmed Ali",
    maskedCnic: "42101-*******-1",
    registrationNumber: "DES-001001",
    preferredLocale: "en",
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    country: { code: "qatar", name: "Qatar" },
    craft: { code: "welder", name: "Welder" },
    active: true,
    ...overrides,
  };
}

function progressPayload(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    documents: {
      requiredTotal: 3,
      missing: 0,
      uploaded: 0,
      pendingReview: 0,
      verified: 3,
      rejected: 0,
      submittedTotal: 3,
      completionPercentage: 100,
      canSubmit: false,
      submissionState: "verified",
      blockingRequirements: [],
    },
    ...overrides,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(candidateProfileClient.getProfile).mockReset();
  jest.mocked(candidateProfileClient.updateEmail).mockReset();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  mockReplace.mockReset();
  // Otherwise a test that toggles to Urdu (AsyncStorage) leaks into
  // whichever test runs next, since LanguageProvider reads it back on mount.
  await AsyncStorage.clear();
});

function renderProfileScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <ProfileScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

// Climbs to the n-th enclosing host View, ignoring wrapper components (e.g. the shared Text), so the
// test does not depend on how many component layers sit between a label and its row.
function hostViewAncestor(node, levels) {
  let current = node;
  for (let found = 0; found < levels; ) {
    current = current.parent;
    if (current.type === "View") found += 1;
  }
  return current;
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
  });

  it("shows a loading state before the profile resolves", async () => {
    candidateProfileClient.getProfile.mockReturnValue(new Promise(() => {}));
    renderProfileScreen();

    expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  });

  it("renders only the approved safe fields once loaded, never the raw CNIC", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("Ahmed Ali")).toBeOnTheScreen();
    // Identifiers carry left-to-right embedding marks so they never reverse in Urdu.
    expect(screen.getByText("\u202A42101-*******-1\u202C")).toBeOnTheScreen();
    expect(screen.getAllByText("\u202ADES-001001\u202C")).toHaveLength(1);
    expect(screen.getByText("Assignment & progress")).toBeOnTheScreen();
    expect(screen.getByText("Preferences & account")).toBeOnTheScreen();
    expect(screen.getByText("Registration / File No.")).toBeOnTheScreen();
    // Only the current status: no separate current-stage or document-verification rows.
    expect(screen.queryByText("Current stage")).toBeNull();
    expect(screen.queryByText("Document verification")).toBeNull();

    expect(screen.queryByText("42101-1234567-1")).toBeNull();
  });

  it("uses the candidate photo in the header", async () => {
    const originalApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://example.com/api/v1";
    const photoUrl = "https://example.com/profile.jpg";
    try {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl }));
      renderProfileScreen();
      await screen.findByText("Ahmed Ali");
      expect(screen.getByTestId("profile-header-photo", { includeHiddenElements: true })).toHaveProp("source", [{ uri: photoUrl }]);
    } finally {
      if (originalApiBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBase;
    }
  });

  it("shows the name initial in the header when no photo is uploaded", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl: null }));
    renderProfileScreen();
    await screen.findByText("Ahmed Ali");
    expect(screen.queryByTestId("profile-header-photo", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText("A", { includeHiddenElements: true })).toHaveLength(2);
  });

  it("shows the current status as the mobilization step and its status, e.g. Visa completed", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockResolvedValue(
      progressPayload({
        workflow: {
          mobilizationProcess: { code: "qatar_mobilization", version: 1, provisional: false, countryCode: "qatar" },
          outcomes: { medical: "fit", visa: null },
          timeline: ["registered", "documents_pending", "verified", "fee_paid", "qvc_completed_outcome_received", "visa_issued_or_rejected", "mobilized"].map(
            (code, index) => ({
              code,
              name: code,
              position: index + 1,
              actionType: "none",
              required: true,
              status: index < 5 ? "completed" : index === 5 ? "current" : "pending",
              startedAt: index === 5 ? "2026-10-01T00:00:00Z" : null,
              completedAt: index < 5 ? "2026-09-01T00:00:00Z" : null,
            })
          ),
          completedCount: 5,
          totalCount: 7,
          progressPercentage: 71,
          updatedAt: "2026-10-01T00:00:00Z",
        },
      })
    );
    renderProfileScreen();

    const row = hostViewAncestor(await screen.findByText("Current status"), 2);
    expect(within(row).getByText("Visa completed")).toBeOnTheScreen();
  });

  it("falls back to the candidate status until progress has loaded", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    renderProfileScreen();

    const row = hostViewAncestor(await screen.findByText("Current status"), 2);
    expect(within(row).getByText("Documents pending")).toBeOnTheScreen();
  });

  it("asks for a clear photo of the candidate's own face, and opens the photo full size when tapped", async () => {
    const originalApiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://example.com/api/v1";
    try {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ photoUrl: "https://example.com/profile.jpg" }));
      renderProfileScreen();

      expect(await screen.findByText("Upload a clear photo of your own face. Other pictures are not allowed.")).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "View photo full size" }));
      fireEvent.press(await screen.findByRole("button", { name: "Close photo" }));
    } finally {
      if (originalApiBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBase;
    }
  });

  it("says a new photo is waiting for approval", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(
      profilePayload({ photoUrl: "/rails/active_storage/blobs/proxy/x/p.jpg", photoStatus: "pending", photoReviewedAt: null })
    );
    renderProfileScreen();

    expect(await screen.findByText("Waiting for approval")).toBeOnTheScreen();
  });

  it("tells the candidate once when staff reject their photo", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    try {
      candidateProfileClient.getProfile.mockResolvedValue(
        profilePayload({ photoUrl: null, photoStatus: "rejected", photoReviewedAt: "2026-11-07T10:00:00Z" })
      );
      renderProfileScreen();

      await waitFor(() =>
        expect(alert).toHaveBeenCalledWith("Picture not approved!", "Please upload a clear photo of your own face.", expect.any(Array))
      );
      alert.mock.calls[0][2][0].onPress();
      await waitFor(async () => expect(await AsyncStorage.getItem("descon.photoRejectionSeen")).toBe("2026-11-07T10:00:00Z"));
      expect(screen.queryByText("Waiting for approval")).toBeNull();
    } finally {
      alert.mockRestore();
      await AsyncStorage.removeItem("descon.photoRejectionSeen");
    }
  });

  it("does not repeat a rejection the candidate has already seen", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await AsyncStorage.setItem("descon.photoRejectionSeen", "2026-11-07T10:00:00Z");
    try {
      candidateProfileClient.getProfile.mockResolvedValue(
        profilePayload({ photoUrl: null, photoStatus: "rejected", photoReviewedAt: "2026-11-07T10:00:00Z" })
      );
      renderProfileScreen();

      expect(await screen.findByText("Ahmed Ali")).toBeOnTheScreen();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(alert).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
      await AsyncStorage.removeItem("descon.photoRejectionSeen");
    }
  });

  it("lets the candidate turn on dark mode, coming back to this screen after the app reloads", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    const darkMode = await screen.findByLabelText("Dark mode");
    expect(screen.getByText("Off")).toBeOnTheScreen();
    fireEvent(darkMode, "valueChange", true);

    expect(mockSetScheme).toHaveBeenCalledWith("dark", "/(tabs)/profile");
  });

  it("shows which country the application is in process for", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("In process for")).toBeOnTheScreen();
    expect(screen.getByText("Qatar")).toBeOnTheScreen();
  });

  it("shows the candidate's craft under the assignment", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("Craft")).toBeOnTheScreen();
    expect(screen.getByText("Welder")).toBeOnTheScreen();
  });

  it("shows the empty-assignment label for the craft when none is known yet", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ craft: null }));
    renderProfileScreen();

    expect(await screen.findByText("Craft")).toBeOnTheScreen();
    expect(screen.getByText("Not assigned yet")).toBeOnTheScreen();
  });

  it("shows the empty-assignment label for the destination when there is no assignment yet", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ country: null }));
    renderProfileScreen();

    expect(await screen.findByText("Not assigned yet")).toBeOnTheScreen();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderProfileScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a distinct inactive-account state, not the generic session-expired one", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    renderProfileScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
    expect(screen.queryByText("Session expired")).toBeNull();
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    candidateProfileClient.getProfile.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(profilePayload());
    renderProfileScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Ahmed Ali");
  });

  it("always keeps logout reachable, even while the profile fails to load", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SERVER_ERROR" });
    renderProfileScreen();

    expect(await screen.findByRole("button", { name: "Logout" })).toBeOnTheScreen();
  });

  it("toggles to Urdu when the language row is pressed", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: "Language" }));

    expect(await screen.findByText("شناختی کارڈ")).toBeOnTheScreen();
  });

  it("keeps the CNIC and file number reading left to right in Urdu, aligned right like the rest", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: "Language" }));
    await screen.findByText("شناختی کارڈ");

    // Wrapped in left-to-right embedding marks, which Android honours (it ignores writingDirection).
    for (const value of ["42101-*******-1", "DES-001001"]) {
      const text = screen.getByText(`\u202A${value}\u202C`);
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({ writingDirection: "ltr", fontFamily: "Inter_500Medium" });
    }
    // The country is ordinary text and still follows Urdu's direction.
    expect(StyleSheet.flatten(screen.getByText("Qatar").props.style).writingDirection).toBe("rtl");
  });

  it("ends the session and returns to sign-in when logout is pressed", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    renderProfileScreen();

    await screen.findByText("Ahmed Ali");
    fireEvent.press(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  describe("email address", () => {
    it("shows Not added yet with an Add button when there is no email", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: null }));
      renderProfileScreen();

      expect(await screen.findByText("Email address")).toBeOnTheScreen();
      expect(screen.getByText("Not added yet")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Add email address" })).toBeOnTheScreen();
    });

    it("saves a new email, lowercased, and shows it after the profile refreshes", async () => {
      candidateProfileClient.getProfile.mockResolvedValueOnce(profilePayload({ email: null }));
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: "candidate@example.com" }));
      candidateProfileClient.updateEmail.mockResolvedValue(profilePayload({ email: "candidate@example.com" }));
      renderProfileScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add email address" }));
      expect(screen.getByText("Descon will send emails to this address.")).toBeOnTheScreen();
      fireEvent.changeText(screen.getByPlaceholderText("name@example.com"), "  Candidate@Example.com ");
      fireEvent.press(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("candidate@example.com")).toBeOnTheScreen();
      expect(candidateProfileClient.updateEmail).toHaveBeenCalledWith({ accessToken: "candidate-access-token", email: "candidate@example.com" });
      expect(screen.queryByPlaceholderText("name@example.com")).toBeNull();
      expect(screen.getByRole("button", { name: "Edit email address" })).toBeOnTheScreen();
    });

    it("refuses a malformed email without calling the server", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: null }));
      renderProfileScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add email address" }));
      fireEvent.changeText(screen.getByPlaceholderText("name@example.com"), "not-an-email");
      fireEvent.press(screen.getByRole("button", { name: "Save" }));

      expect(screen.getByText("Enter a valid email address, e.g. name@example.com.")).toBeOnTheScreen();
      expect(candidateProfileClient.updateEmail).not.toHaveBeenCalled();
    });

    it("shows the server's message when it refuses the email, keeping the editor open", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: "old@example.com" }));
      candidateProfileClient.updateEmail.mockRejectedValue({ code: "INVALID_EMAIL", message: "That email address can't be used." });
      renderProfileScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Edit email address" }));
      expect(screen.getByPlaceholderText("name@example.com").props.value).toBe("old@example.com");
      fireEvent.changeText(screen.getByPlaceholderText("name@example.com"), "new@example.com");
      fireEvent.press(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("That email address can't be used.")).toBeOnTheScreen();
      expect(screen.getByPlaceholderText("name@example.com")).toBeOnTheScreen();
    });

    it("shows a network problem and lets the candidate cancel", async () => {
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: null }));
      candidateProfileClient.updateEmail.mockRejectedValue({ code: "NETWORK_ERROR" });
      renderProfileScreen();

      fireEvent.press(await screen.findByRole("button", { name: "Add email address" }));
      fireEvent.changeText(screen.getByPlaceholderText("name@example.com"), "a@b.co");
      fireEvent.press(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Couldn't reach the server. Check your connection and try again.", {}, { timeout: 5000 })).toBeOnTheScreen();
      fireEvent.press(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByPlaceholderText("name@example.com")).toBeNull();
      expect(screen.getByText("Not added yet")).toBeOnTheScreen();
    });

    it("shows the email row in Urdu, keeping the address left to right", async () => {
      await AsyncStorage.setItem("descon.language", "ur");
      candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ email: "candidate@example.com" }));
      renderProfileScreen();

      expect(await screen.findByText("ای میل ایڈریس")).toBeOnTheScreen();
      expect(StyleSheet.flatten(screen.getByText("candidate@example.com").props.style).writingDirection).toBe("ltr");
      expect(screen.getByRole("button", { name: "ای میل ایڈریس تبدیل کریں" })).toBeOnTheScreen();
    });
  });
});
