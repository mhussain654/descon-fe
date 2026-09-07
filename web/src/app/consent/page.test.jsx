import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { candidateConsentClient } from "../../lib/candidate-consent-client";
import ConsentPage from "./page";

vi.mock("../../lib/candidate-consent-client", () => ({
  candidateConsentClient: { fetchStatus: vi.fn(), accept: vi.fn() },
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
            consent: { currentPolicyVersion: "2026-09-06", accepted: false, acceptedAt: null },
          })
        }
      >
        login
      </button>
      <Link to="/consent">Go to consent</Link>
    </div>
  );
}

function DashboardStub() {
  return <p>Dashboard screen</p>;
}

function renderConsentPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/login" element={<LoginStub />} />
              <Route path="/consent" element={<ConsentPage />} />
              <Route path="/dashboard" element={<DashboardStub />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe("ConsentPage", () => {
  afterEach(() => {
    vi.mocked(candidateConsentClient.accept).mockReset();
  });

  it("redirects to /login instead of rendering when unauthenticated", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={["/consent"]}>
              <Routes>
                <Route path="/login" element={<p>Login screen</p>} />
                <Route path="/consent" element={<ConsentPage />} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("shows the consent message and an Accept action for a candidate who hasn't accepted", () => {
    renderConsentPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(screen.getByText("Go to consent"));
    expect(screen.getByText("I Agree & Continue")).toBeInTheDocument();
  });

  it("records acceptance and navigates to the dashboard on success", async () => {
    vi.mocked(candidateConsentClient.accept).mockResolvedValue({
      currentPolicyVersion: "2026-09-06",
      accepted: true,
      acceptedAt: "2026-09-06T12:00:00Z",
    });
    renderConsentPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(screen.getByText("Go to consent"));

    fireEvent.click(screen.getByText("I Agree & Continue"));

    await waitFor(() => expect(screen.getByText("Dashboard screen")).toBeInTheDocument());
    expect(candidateConsentClient.accept).toHaveBeenCalledWith("candidate-access-token");
  });

  it("shows an error message and stays on the consent screen when acceptance fails", async () => {
    vi.mocked(candidateConsentClient.accept).mockRejectedValue({ code: "SERVER_ERROR" });
    renderConsentPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(screen.getByText("Go to consent"));

    fireEvent.click(screen.getByText("I Agree & Continue"));

    expect(await screen.findByText("We could not record your consent. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard screen")).not.toBeInTheDocument();
  });

  it("logs the candidate out when they decline", async () => {
    renderConsentPage();
    fireEvent.click(screen.getByText("login"));
    fireEvent.click(screen.getByText("Go to consent"));

    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => expect(screen.getByText("Login screen")).toBeInTheDocument());
  });
});
