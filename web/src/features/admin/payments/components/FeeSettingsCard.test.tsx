import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../../contexts/StaffAuthContext";
import { adminFeesClient } from "../../../../lib/admin-fees-client";
import { FeeSettingsCard } from "./FeeSettingsCard";
vi.mock("../../../../lib/admin-fees-client", () => ({
  adminFeesClient: { getFee: vi.fn(), updateFee: vi.fn() },
}));
const fee = {
  defaultAmount: "26800.00",
  overrideAmount: null,
  effectiveAmount: "26800.00",
  currencyCode: "PKR",
  version: 3,
  assignmentId: "assignment-1",
  locked: false,
  updatedAt: "2026-10-04T09:00:00Z",
};
async function mount(candidateId?: string, role = "finance") {
  const account = MOCK_STAFF_ACCOUNTS.find(
    (x) => x.role === role && !x.locked && !x.suspended,
  )!;
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <FeeSettingsCard candidateId={candidateId} />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.mocked(adminFeesClient.getFee).mockResolvedValue(fee);
});
afterEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});
describe("FeeSettingsCard", () => {
  it("sets the global default with a reason", async () => {
    vi.mocked(adminFeesClient.updateFee).mockResolvedValue({
      ...fee,
      version: 4,
    });
    await mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Set default fee" }),
    );
    fireEvent.change(screen.getByLabelText("Fee amount (PKR)"), {
      target: { value: "26800" },
    });
    fireEvent.change(screen.getByLabelText("Reason for change"), {
      target: { value: "Approved standard fee" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(adminFeesClient.updateFee).toHaveBeenCalledWith(
        {
          amount: "26800",
          expectedVersion: 3,
          reason: "Approved standard fee",
        },
        undefined,
      ),
    );
    expect(await screen.findByText("Fee saved.")).toBeInTheDocument();
  });
  it("sets an override before the payment stage and validates the reason", async () => {
    vi.mocked(adminFeesClient.updateFee).mockResolvedValue({
      ...fee,
      overrideAmount: "25000.00",
      effectiveAmount: "25000.00",
      version: 4,
    });
    await mount("candidate-1");
    fireEvent.click(await screen.findByRole("button", { name: "Change fee" }));
    expect(screen.getByLabelText("Use default fee")).toBeChecked();
    fireEvent.change(screen.getByLabelText("Fee amount (PKR)"), {
      target: { value: "25000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByText("Enter a reason for this change."),
    ).toBeInTheDocument();
    expect(adminFeesClient.updateFee).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason for change"), {
      target: { value: "Approved candidate adjustment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(adminFeesClient.updateFee).toHaveBeenCalledWith(
        {
          amount: "25000",
          expectedVersion: 3,
          reason: "Approved candidate adjustment",
        },
        "candidate-1",
      ),
    );
  });
  it("removes an override explicitly", async () => {
    vi.mocked(adminFeesClient.getFee).mockResolvedValue({
      ...fee,
      overrideAmount: "25000.00",
      effectiveAmount: "25000.00",
    });
    vi.mocked(adminFeesClient.updateFee).mockResolvedValue({
      ...fee,
      version: 4,
    });
    await mount("candidate-1");
    fireEvent.click(await screen.findByRole("button", { name: "Change fee" }));
    fireEvent.click(screen.getByLabelText("Use default fee"));
    fireEvent.change(screen.getByLabelText("Reason for change"), {
      target: { value: "Return to standard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(adminFeesClient.updateFee).toHaveBeenCalledWith(
        { amount: null, expectedVersion: 3, reason: "Return to standard" },
        "candidate-1",
      ),
    );
  });
  it("prevents fee editing for active or settled payments", async () => {
    vi.mocked(adminFeesClient.getFee).mockResolvedValue({
      ...fee,
      locked: true,
    });
    await mount("candidate-1");
    expect(
      await screen.findByText(
        "Fee is locked during an active checkout or after payment.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change fee" }),
    ).not.toBeInTheDocument();
  });
  it("keeps entered values after an API failure", async () => {
    vi.mocked(adminFeesClient.updateFee).mockRejectedValue({
      code: "NETWORK_ERROR",
    });
    await mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Set default fee" }),
    );
    fireEvent.change(screen.getByLabelText("Fee amount (PKR)"), {
      target: { value: "29000" },
    });
    fireEvent.change(screen.getByLabelText("Reason for change"), {
      target: { value: "New approved fee" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Could not save the fee. Please retry."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fee amount (PKR)")).toHaveValue("29000");
  });
  it("does not fetch financial settings for HR", async () => {
    await mount("candidate-1", "hr");
    expect(adminFeesClient.getFee).not.toHaveBeenCalled();
  });
  it("renders Urdu copy", async () => {
    localStorage.setItem("descon.language", "ur");
    await mount();
    expect(
      await screen.findByText("پہلے سے مقرر آن بورڈنگ فیس"),
    ).toBeInTheDocument();
  });
});
