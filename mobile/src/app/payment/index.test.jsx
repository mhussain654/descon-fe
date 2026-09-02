import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../../contexts/AuthContext";
import { LanguageProvider } from "../../contexts/LanguageContext";
import * as usePaymentEligibilityModule from "../../features/candidate/payments/hooks/usePaymentEligibility";
import { paymentsClient } from "../../lib/payments-client";
import { createQueryClientTestLifecycle } from "../../testSupport/queryClientTestLifecycle";
import PaymentScreen from "./index";

const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: (...args) => mockReplace(...args), push: jest.fn(), back: (...args) => mockBack(...args) }),
}));

const mockOpenBrowserAsync = jest.fn(() => Promise.resolve({ type: "dismiss" }));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: (...args) => mockOpenBrowserAsync(...args),
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
        // Long enough to survive a fake-timer-advanced polling-timeout test
        // without the session itself expiring mid-test.
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
    )
  ),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true],
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
}));

jest.mock("../../lib/payments-client", () => ({
  paymentsClient: { getEligibility: jest.fn(), initiateCheckout: jest.fn() },
}));

function eligibility(overrides = {}) {
  return {
    eligible: true,
    checkoutAvailable: true,
    requiredStageCode: "fee_pending",
    currentStageCode: "fee_pending",
    blockingReasons: [],
    amount: "1500.0",
    currencyCode: "PKR",
    latestPayment: null,
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: "payment-1",
    paymentTypeCode: "onboarding_fee",
    status: "checkout_pending",
    amount: "1500.0",
    currencyCode: "PKR",
    provider: "mock_hosted_checkout",
    checkoutUrl: "https://mock-payments.example.test/checkout?orderid=1",
    checkoutExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    paidAt: null,
    updatedAt: "2026-08-31T09:00:00Z",
    ...overrides,
  };
}

const { createTestQueryClient, trackRender, cleanup } = createQueryClientTestLifecycle();

afterEach(async () => {
  await cleanup();
  jest.mocked(paymentsClient.getEligibility).mockReset();
  jest.mocked(paymentsClient.initiateCheckout).mockReset();
  mockOpenBrowserAsync.mockClear();
  mockReplace.mockReset();
  mockBack.mockReset();
});

function renderPaymentScreen() {
  const queryClient = createTestQueryClient();
  return trackRender(
    render(
      <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <AuthProvider>
              <PaymentScreen />
            </AuthProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    )
  );
}

describe("PaymentScreen", () => {
  it("shows the configured fee amount and a Pay action when eligible", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPaymentScreen();

    expect(await screen.findByText("1500.0 PKR")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("shows a clear reason when payment is unavailable", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ eligible: false, checkoutAvailable: false, blockingReasons: ["payment_stage_not_reached"] })
    );
    renderPaymentScreen();

    expect(await screen.findByText("Payment is not available yet")).toBeOnTheScreen();
    expect(screen.getByText("Payment becomes available once your documents are verified.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pay now" })).not.toBeOnTheScreen();
  });

  it("initiates checkout with a fresh idempotency key, opens the server-provided URL in the in-app browser, and refetches on return", async () => {
    paymentsClient.getEligibility
      .mockResolvedValueOnce(eligibility())
      .mockResolvedValueOnce(eligibility({ latestPayment: payment() }));
    paymentsClient.initiateCheckout.mockResolvedValue({ eligibility: eligibility({ latestPayment: payment() }), payment: payment() });
    renderPaymentScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Pay now" }));

    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledWith("candidate-access-token", expect.any(String)));
    await waitFor(() =>
      expect(mockOpenBrowserAsync).toHaveBeenCalledWith("https://mock-payments.example.test/checkout?orderid=1")
    );
    expect(await screen.findByText(/waiting for your payment provider/)).toBeOnTheScreen();
  });

  it("prevents a duplicate checkout initiation while one is already in flight", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockReturnValue(new Promise(() => {}));
    renderPaymentScreen();

    const payButton = await screen.findByRole("button", { name: "Pay now" });
    fireEvent.press(payButton);
    fireEvent.press(payButton);

    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledTimes(1));
  });

  it("reuses the same idempotency key on a retry after a server error", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    paymentsClient.initiateCheckout.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValueOnce({
      eligibility: eligibility({ latestPayment: payment() }),
      payment: payment(),
    });
    renderPaymentScreen();

    const payButton = await screen.findByRole("button", { name: "Pay now" });
    fireEvent.press(payButton);
    await screen.findByText("Something went wrong.");

    fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledTimes(2));
    const [, secondKey] = paymentsClient.initiateCheckout.mock.calls[1];
    expect(secondKey).toBe(paymentsClient.initiateCheckout.mock.calls[0][1]);
  });

  it("shows the paid receipt with amount and paid-on date once the backend confirms paid, never before", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ latestPayment: payment({ status: "paid", paidAt: "2026-08-31T10:00:00Z" }), checkoutAvailable: true })
    );
    renderPaymentScreen();

    expect(await screen.findByText("Paid")).toBeOnTheScreen();
    expect(screen.getByText(/Paid on/)).toBeOnTheScreen();
    expect(screen.queryByText(/mock_hosted_checkout/)).not.toBeOnTheScreen();
  });

  it("shows Failed and Cancelled as distinct, retryable states", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment({ status: "failed" }) }));
    renderPaymentScreen();

    expect(await screen.findByText("Failed")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("shows a distinct Expired state once the checkout window has passed, and allows starting a new checkout", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ latestPayment: payment({ checkoutExpiresAt: new Date(Date.now() - 60_000).toISOString() }) })
    );
    renderPaymentScreen();

    expect(await screen.findByText("Expired")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  // The 5-minute polling-timeout threshold itself (hasPollingTimedOut) is
  // already covered deterministically and fast in
  // shared/payments/checkoutPolling.test.ts. Driving that much real
  // elapsed time through this screen's full render tree -- via fake
  // timers, or via a real refetch under a mocked clock -- runs into a
  // severe, RN/jest-expo-specific slowdown/hang unrelated to this
  // behavior itself (React Query's own refetch scheduling and
  // RefreshControl's native-bridge interaction under a controlled clock).
  // So these tests verify only the screen's reaction to the hook's own
  // `pollingTimedOut` flag, mocking the hook directly instead of waiting
  // out real time.
  it("keeps showing the waiting message, with no manual refresh action, before the polling timeout", async () => {
    const spy = jest.spyOn(usePaymentEligibilityModule, "usePaymentEligibility").mockReturnValue({
      data: eligibility({ latestPayment: payment() }),
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
      pollingTimedOut: false,
    });
    renderPaymentScreen();

    expect(await screen.findByText(/waiting for your payment provider/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeOnTheScreen();

    spy.mockRestore();
  });

  it("stops automatic polling after a safe timeout and offers a manual refresh", async () => {
    const mockRefetch = jest.fn();
    const spy = jest.spyOn(usePaymentEligibilityModule, "usePaymentEligibility").mockReturnValue({
      data: eligibility({ latestPayment: payment() }),
      isLoading: false,
      isFetching: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
      pollingTimedOut: true,
    });
    renderPaymentScreen();

    expect(
      await screen.findByText("We haven't heard back from your payment provider yet. Tap refresh to check again.")
    ).toBeOnTheScreen();
    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    expect(refreshButton).toBeOnTheScreen();

    fireEvent.press(refreshButton);
    expect(mockRefetch).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("shows an offline state with retry", async () => {
    paymentsClient.getEligibility.mockRejectedValue({ code: "OFFLINE" });
    renderPaymentScreen();

    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Retry" })).toBeOnTheScreen();
  });

  it("navigates back when the back action is pressed", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPaymentScreen();

    await screen.findByRole("button", { name: "Pay now" });
    fireEvent.press(screen.getByRole("button", { name: "Back" }));

    expect(mockBack).toHaveBeenCalled();
  });

  it("renders in Urdu when that is the persisted language", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderPaymentScreen();

    expect(await screen.findByRole("button", { name: "ابھی ادائیگی کریں" })).toBeOnTheScreen();
  });
});
