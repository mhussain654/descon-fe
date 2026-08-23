import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import StaffLoginPage from "./page";

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

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
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: MOCK_STAFF_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Staff dashboard stub")).toBeInTheDocument());
  });

  it("shows a single generic error for invalid credentials, without naming a field", async () => {
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: ADMIN.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument());
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("shows the identical generic error for an unknown email as for a wrong password", async () => {
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
});
