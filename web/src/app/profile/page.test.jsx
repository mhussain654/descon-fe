import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { candidateProfileClient } from "../../lib/candidate-profile-client";
import ProfilePage from "./page";

vi.mock("../../lib/candidate-profile-client", () => ({
  candidateProfileClient: { getProfile: vi.fn() },
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
      <Link to="/profile">Go to profile</Link>
    </div>
  );
}

function renderProfilePage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

async function signInAndNavigateToProfile() {
  renderProfilePage();
  fireEvent.click(screen.getByText("login"));
  fireEvent.click(await screen.findByText("Go to profile"));
}

function profilePayload(overrides = {}) {
  return {
    id: "candidate-public-id-1",
    fullName: "Ahmed Ali",
    maskedCnic: "42101-*******-1",
    referenceNumber: "DES-001001",
    preferredLocale: "en",
    candidateStatus: "documents_pending",
    currentWorkflowStage: { code: "documents_pending", name: "Documents pending" },
    active: true,
    ...overrides,
  };
}

describe("ProfilePage", () => {
  afterEach(() => {
    vi.mocked(candidateProfileClient.getProfile).mockReset();
  });

  it("shows a loading state before the profile resolves", async () => {
    candidateProfileClient.getProfile.mockReturnValue(new Promise(() => {}));
    await signInAndNavigateToProfile();

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders only the approved safe fields once loaded, never the raw CNIC", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    await signInAndNavigateToProfile();

    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.getByText("42101-*******-1")).toBeInTheDocument();
    expect(screen.getAllByText("DES-001001").length).toBeGreaterThan(0);
    expect(screen.getByText("Documents pending")).toBeInTheDocument();
    expect(screen.getAllByText("English").length).toBeGreaterThan(0);

    // The real CNIC value must never appear anywhere in the rendered output.
    expect(screen.queryByText("42101-1234567-1")).not.toBeInTheDocument();
  });

  it("shows the empty-assignment label when there is no current workflow stage", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload({ currentWorkflowStage: null }));
    await signInAndNavigateToProfile();

    expect(await screen.findByText("Not assigned yet")).toBeInTheDocument();
  });

  it("shows the empty-assignment label for both reference number and workflow stage when the candidate has no assignment yet", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(
      profilePayload({ referenceNumber: null, currentWorkflowStage: null })
    );
    await signInAndNavigateToProfile();

    await screen.findByText("Ahmed Ali");
    const notAssignedYet = screen.getAllByText("Not assigned yet");
    // One for the reference-number row, one for the workflow-stage row, plus
    // the header line under the candidate's name -- three in total.
    expect(notAssignedYet).toHaveLength(3);
    expect(screen.queryByText("DES-001001")).not.toBeInTheDocument();
  });

  it("shows a session-expired state and returns to sign-in on the confirming action, ending the session", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SESSION_EXPIRED" });
    await signInAndNavigateToProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Sign in again" }));

    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("shows a distinct inactive-account state, not the generic session-expired one", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "INACTIVE_ACCOUNT" });
    await signInAndNavigateToProfile();

    expect(await screen.findByText("Account inactive")).toBeInTheDocument();
    expect(screen.getByText("Your account is inactive. Contact Descon for help.")).toBeInTheDocument();
  });

  it("shows an offline state with a retry action for a network failure", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "OFFLINE" });
    await signInAndNavigateToProfile();

    expect(await screen.findByText("You are offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries the query when the retry action is used after a server error", async () => {
    candidateProfileClient.getProfile
      .mockRejectedValueOnce({ code: "SERVER_ERROR" })
      .mockResolvedValueOnce(profilePayload());
    await signInAndNavigateToProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
  });

  it("always keeps logout reachable, even while the profile fails to load", async () => {
    candidateProfileClient.getProfile.mockRejectedValue({ code: "SERVER_ERROR" });
    await signInAndNavigateToProfile();

    await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });

  it("renders the profile in Urdu when the language is switched", async () => {
    candidateProfileClient.getProfile.mockResolvedValue(profilePayload());
    await signInAndNavigateToProfile();

    await screen.findByText("Ahmed Ali");
    fireEvent.click(screen.getByRole("button", { name: /Language/i }));

    expect(await screen.findByText("شناختی کارڈ")).toBeInTheDocument();
    expect(screen.getByText("ذاتی معلومات")).toBeInTheDocument();
  });
});
