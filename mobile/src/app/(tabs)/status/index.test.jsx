import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../../contexts/AuthContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { applicationProgressClient } from "../../../lib/application-progress-client";
import { createQueryClientTestLifecycle } from "../../../testSupport/queryClientTestLifecycle";
import StatusScreen from "./index";

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

jest.mock("../../../lib/application-progress-client", () => ({
  applicationProgressClient: { getProgress: jest.fn(), submitDocuments: jest.fn() },
}));

function progressPayload(overrides = {}) {
  return {
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    documents: {
      requiredTotal: 2,
      missing: 1,
      uploaded: 1,
      pendingReview: 0,
      verified: 0,
      rejected: 0,
      submittedTotal: 1,
      completionPercentage: 50,
      canSubmit: false,
      submissionState: "incomplete",
      blockingRequirements: [],
      ...overrides,
    },
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(applicationProgressClient.getProgress).mockReset();
  mockReplace.mockReset();
});

function renderStatusScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <StatusScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

function stageRow(labelText) {
  // getByText returns the host Text node; its own `.parent` is Text's
  // composite wrapper, so the JSX content-column View that also holds the
  // sibling "In Progress" badge is one level further up.
  return screen.getByText(labelText).parent.parent;
}

describe("StatusScreen", () => {
  it("shows a loading state before progress resolves", async () => {
    applicationProgressClient.getProgress.mockReturnValue(new Promise(() => {}));
    renderStatusScreen();

    expect(await screen.findByText("Loading…")).toBeOnTheScreen();
  });

  it("renders the full approved-prototype timeline, including the downstream stages that have no backend data yet", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    renderStatusScreen();

    expect(await screen.findByText("Registered")).toBeOnTheScreen();
    expect(screen.getByText("Documents Pending")).toBeOnTheScreen();
    expect(screen.getByText("Documents Uploaded")).toBeOnTheScreen();
    expect(screen.getByText("Verified")).toBeOnTheScreen();
    expect(screen.getByText("Fee Pending")).toBeOnTheScreen();
    expect(screen.getByText("QVC Appointment Booked")).toBeOnTheScreen();
    expect(screen.getByText("Visa Issued")).toBeOnTheScreen();
    expect(screen.getByText("Mobilized")).toBeOnTheScreen();
  });

  it("marks documents-uploaded as the in-progress stage while documents are incomplete", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "incomplete" }));
    renderStatusScreen();

    await screen.findByText("Documents Uploaded");
    expect(within(stageRow("Documents Uploaded")).getByText("In Progress")).toBeOnTheScreen();
    expect(within(stageRow("Verified")).queryByText("In Progress")).toBeNull();
  });

  it("marks verified as the in-progress stage once documents are submitted but not yet fully verified", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "partially_verified" }));
    renderStatusScreen();

    await screen.findByText("Verified");
    expect(within(stageRow("Verified")).getByText("In Progress")).toBeOnTheScreen();
  });

  it("shows no in-progress stage and never fabricates downstream progress once fully verified", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload({ submissionState: "verified" }));
    renderStatusScreen();

    await screen.findByText("Verified");
    expect(screen.queryByText("In Progress")).toBeNull();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "SESSION_EXPIRED" });
    renderStatusScreen();

    expect(await screen.findByText("Session expired")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a distinct inactive-account state and returns to sign-in on the confirming action", async () => {
    applicationProgressClient.getProgress.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    renderStatusScreen();

    expect(await screen.findByText("Account inactive")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Return to sign in" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "OFFLINE" }).mockResolvedValueOnce(progressPayload());
    renderStatusScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Registered");
  });

  it("retries the query when the retry action is used after a server error", async () => {
    applicationProgressClient.getProgress.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce(progressPayload());
    renderStatusScreen();

    expect(await screen.findByText("Something went wrong.")).toBeOnTheScreen();
    fireEvent.press(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Registered");
  });

  it("renders the timeline in Urdu when that is the persisted language", async () => {
    applicationProgressClient.getProgress.mockResolvedValue(progressPayload());
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderStatusScreen();

    expect(await screen.findByText("رجسٹرڈ")).toBeOnTheScreen();
  });
});
