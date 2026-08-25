import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import StaffLoginPage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

// admin/login/page.jsx submits through the real, module-level
// `staffAuthClient` singleton (../../../lib/staff-auth-client.ts), not
// through the `client` prop given to StaffAuthProvider below -- that prop
// only backs useStaffAuth()'s status/session/restoreSession/signOut. So the
// actual sign-in network call is mocked at the fetch boundary here, per
// AGENTS.md: "Mock the centralized API boundary ... Do not call live
// backend or provider services from unit/component tests."
const originalFetch = globalThis.fetch;

function successEnvelope(data) {
  return { data, meta: {}, errors: [] };
}

function errorEnvelope(errors) {
  return { errors, request_id: "req-1" };
}

function loginSuccessResponse(overrides = {}) {
  return new Response(
    JSON.stringify(
      successEnvelope({
        access_token: "access-1",
        refresh_token: "refresh-1",
        token_type: "Bearer",
        expires_in: 900,
        session: { id: "session-1" },
        user: { id: "staff-1", email: ADMIN.email, role: "admin" },
        ...overrides,
      })
    ),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}

function errorResponse(status, code, message) {
  return new Response(JSON.stringify(errorEnvelope([{ code, message }])), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubLoginFetch(responseFactory) {
  globalThis.fetch = (async (url) => {
    if (typeof url === "string" && url.includes("/auth/login")) return responseFactory();
    throw new Error(`page.test.jsx: unexpected fetch to ${url}`);
  });
}

function renderLoginPage(client = createMockStaffAuthClient({ delayMs: 0 })) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter initialEntries={["/admin/login"]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<StaffLoginPage />} />
              <Route path="/admin" element={<p>Staff dashboard stub</p>} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, client };
}

describe("StaffLoginPage", () => {
  afterEach(() => {
    sessionStorage.clear();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
    document.documentElement.removeAttribute("dir");
    document.documentElement.removeAttribute("lang");
  });

  it("contains exactly the email and password fields -- no candidate CNIC/OTP UI", async () => {
    renderLoginPage();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText(/cnic/i)).not.toBeInTheDocument();
  });

  it("requires both fields before submitting", async () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("signs in with valid credentials and navigates to the staff dashboard", async () => {
    stubLoginFetch(() => loginSuccessResponse());
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Staff dashboard stub")).toBeInTheDocument());
  });

  it("shows a single generic error for invalid credentials, without naming a field", async () => {
    stubLoginFetch(() => errorResponse(401, "unauthorized", "Invalid credentials."));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument());
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows the identical generic error for an unknown email as for a wrong password", async () => {
    // The real backend collapses unknown-email and wrong-password into the
    // identical 401 unauthorized -- never distinguishable from the response.
    stubLoginFetch(() => errorResponse(401, "unauthorized", "Invalid credentials."));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nobody@descon.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument());
  });

  it("redirects an already-authenticated staff member straight to the dashboard", async () => {
    const client = createMockStaffAuthClient({ delayMs: 0 });
    await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });

    renderLoginPage(client);

    await waitFor(() => expect(screen.getByText("Staff dashboard stub")).toBeInTheDocument());
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("shows the inactive-account message when the backend reports one, distinct from invalid credentials", async () => {
    stubLoginFetch(() => errorResponse(403, "inactive_account", "This account is inactive."));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByText("This account is inactive. Contact your administrator.")).toBeInTheDocument()
    );
  });

  it("shows the rate-limited message after too many sign-in attempts", async () => {
    stubLoginFetch(() => errorResponse(429, "rate_limited", "Too many authentication attempts."));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByText("Too many sign-in attempts. Please try again later.")).toBeInTheDocument()
    );
  });

  it("shows a network-error message, not a raw/technical one, on a connectivity failure", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeInTheDocument());
  });

  it("renders in Urdu/RTL, including a translated inactive-account message", async () => {
    window.localStorage.setItem("descon.language", "ur");
    stubLoginFetch(() => errorResponse(403, "inactive_account", "This account is inactive."));
    renderLoginPage();

    await act(async () => {
      await Promise.resolve();
    });
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByLabelText("ای میل")).toBeInTheDocument();
    expect(screen.getByLabelText("پاس ورڈ")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("ای میل"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("پاس ورڈ"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "سائن ان کریں" }));

    await waitFor(() =>
      expect(screen.getByText("یہ اکاؤنٹ غیر فعال ہے۔ براہ کرم اپنے منتظم سے رابطہ کریں۔")).toBeInTheDocument()
    );
  });
});
