import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
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

// A real WebView can't run in jest -- this stand-in renders nothing but
// captures the props the screen passes it, so a test can assert what URL
// it was asked to load and drive its onNavigationStateChange callback the
// same way a real return-URL navigation would.
let latestWebViewProps = null;
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return {
    WebView: (props) => {
      latestWebViewProps = props;
      return <View testID="hosted-checkout-webview" />;
    },
  };
});

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

jest.mock("@expo-google-fonts/inter", () => ({
  useFonts: () => [true],
  Inter_400Regular: "Inter_400Regular",
  Inter_500Medium: "Inter_500Medium",
  Inter_600SemiBold: "Inter_600SemiBold",
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

jest.mock("../../lib/payments-client", () => ({
  paymentsClient: { getEligibility: jest.fn(), initiateCheckout: jest.fn(), createVoucher: jest.fn() },
}));

// The server says whether a card checkout is open: an unexpired, pending payment that is not a payment code.
function cardCheckoutOpenFor(latestPayment) {
  return Boolean(
    latestPayment &&
      latestPayment.provider !== "kuickpay_voucher" &&
      latestPayment.status === "checkout_pending" &&
      new Date(latestPayment.checkoutExpiresAt) > new Date()
  );
}

function eligibility(overrides = {}) {
  return {
    eligible: true,
    checkoutAvailable: true,
    voucherAvailable: false,
    openVoucher: null,
    cardCheckoutOpen: cardCheckoutOpenFor(overrides.latestPayment),
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
    voucherNumber: null,
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
  jest.mocked(paymentsClient.createVoucher).mockReset();
  latestWebViewProps = null;
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

  it("initiates checkout with a fresh idempotency key, embeds the server-provided URL in the checkout WebView, and refetches once closed", async () => {
    paymentsClient.getEligibility
      .mockResolvedValueOnce(eligibility())
      .mockResolvedValueOnce(eligibility({ latestPayment: payment() }));
    paymentsClient.initiateCheckout.mockResolvedValue({ eligibility: eligibility({ latestPayment: payment() }), payment: payment() });
    renderPaymentScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Pay now" }));

    await waitFor(() => expect(paymentsClient.initiateCheckout).toHaveBeenCalledWith("candidate-access-token", expect.any(String)));
    await waitFor(() => expect(screen.getByTestId("hosted-checkout-webview")).toBeOnTheScreen());
    expect(latestWebViewProps.source).toEqual({ uri: "https://mock-payments.example.test/checkout?orderid=1" });

    // Closing the embedded checkout (back gesture, its own close button, or
    // reaching the return URL all call the same onClose) must never itself
    // imply success -- only a subsequent GET returning "paid" can.
    jest.mocked(paymentsClient.getEligibility).mockResolvedValueOnce(eligibility({ latestPayment: payment() }));
    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByTestId("hosted-checkout-webview")).not.toBeOnTheScreen();
    expect(screen.queryByText("Paid")).not.toBeOnTheScreen();
    await waitFor(() => expect(paymentsClient.getEligibility).toHaveBeenCalledTimes(2));
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

  it("shows the paid receipt with amount, paid-on date, and the safe payment reference id once the backend confirms paid, never before", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({
        latestPayment: payment({ id: "payment-public-id-42", status: "paid", paidAt: "2026-08-31T10:00:00Z" }),
        checkoutAvailable: true,
        voucherAvailable: false,
        openVoucher: null,
        cardCheckoutOpen: false,
      })
    );
    renderPaymentScreen();

    expect(await screen.findByText("Paid")).toBeOnTheScreen();
    expect(screen.getByText(/Paid on/)).toBeOnTheScreen();
    expect(screen.getByText(/Payment reference/)).toBeOnTheScreen();
    expect(screen.getByText(/payment-public-id-42/)).toBeOnTheScreen();
    expect(screen.queryByText(/mock_hosted_checkout/)).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pay now" })).toBeNull();
  });

  it("shows Failed and Cancelled as distinct, retryable states", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment({ status: "failed" }) }));
    renderPaymentScreen();

    expect(await screen.findByText("Failed")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("shows Cancelled and allows a new eligible payment", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment({ status: "cancelled" }) }));
    renderPaymentScreen();
    expect(await screen.findByText("Cancelled")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("keeps checkout unavailable while confirmation is pending", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ latestPayment: payment() }));
    renderPaymentScreen();
    expect(await screen.findByText("Pending")).toBeOnTheScreen();
    expect(screen.getByText(/waiting for your payment provider/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pay now" })).toBeNull();
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

describe("PaymentScreen payment code (voucher)", () => {
  // The Urdu test above leaves "ur" persisted; these run in English unless they say otherwise.
  beforeEach(async () => {
    await require("@react-native-async-storage/async-storage").removeItem("descon.language");
  });

  const voucher = (overrides = {}) =>
    payment({
      id: "voucher-1",
      provider: "kuickpay_voucher",
      checkoutUrl: null,
      voucherNumber: "0000832249220",
      checkoutExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    });

  it("opens on the payment code tab when both ways are offered, and can switch to the card tab", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    renderPaymentScreen();

    expect(await screen.findByRole("button", { name: "Get my payment code" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pay now" })).toBeNull();

    fireEvent.press(screen.getByRole("tab", { name: "Pay by card" }));

    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("shows no tabs when only the card is offered", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility());
    renderPaymentScreen();

    await screen.findByRole("button", { name: "Pay now" });
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("gets a payment code and shows it with the steps", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    const issued = voucher();
    paymentsClient.createVoucher.mockResolvedValue({
      eligibility: eligibility({ voucherAvailable: true, openVoucher: issued, latestPayment: issued }),
      payment: issued,
    });
    renderPaymentScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Get my payment code" }));

    expect(await screen.findByText("0000832249220")).toBeOnTheScreen();
    expect(paymentsClient.createVoucher).toHaveBeenCalledWith("candidate-access-token", expect.any(String));
    expect(screen.getByText("How to pay your code")).toBeOnTheScreen();
    expect(screen.getByText(/Once your payment is received/)).toBeOnTheScreen();
  });

  it("copies the payment code with the Copy button and says so", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, openVoucher: voucher(), latestPayment: voucher() })
    );
    renderPaymentScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Copy code" }));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith("0000832249220"));
    expect(await screen.findByText("Code copied")).toBeOnTheScreen();
  });

  it("explains the two ways to pay: from the phone and at a shop", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, openVoucher: voucher(), latestPayment: voucher() })
    );
    renderPaymentScreen();

    expect(await screen.findByText("How to pay your code")).toBeOnTheScreen();
    expect(screen.getByText("From your phone")).toBeOnTheScreen();
    expect(screen.getByText(/Open your JazzCash or Easypaisa app, or your bank app/)).toBeOnTheScreen();
    expect(screen.getByText("At a shop")).toBeOnTheScreen();
    expect(screen.getByText(/go to a JazzCash or Easypaisa shop/)).toBeOnTheScreen();
    expect(screen.getByText("Pay as soon as you can, so your process is not delayed.")).toBeOnTheScreen();
    expect(screen.queryByRole("link", { name: "JazzCash" })).toBeNull();
  });

  it("lets the candidate choose the card while a code is open, with a warning to pay one way only", async () => {
    const open = voucher();
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, openVoucher: open, latestPayment: open }));
    renderPaymentScreen();

    expect(await screen.findByText(/Pay by code or by card, not both/)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole("tab", { name: "Pay by card" }));

    expect(screen.getByText(/You already have a payment code/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeOnTheScreen();
  });

  it("still shows the open code when the newest payment is a card checkout", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, openVoucher: voucher(), cardCheckoutOpen: true, latestPayment: payment() })
    );
    renderPaymentScreen();

    expect(await screen.findByText("0000832249220")).toBeOnTheScreen();
  });

  it("lets the candidate get a code while a card checkout is in progress, with a warning", async () => {
    paymentsClient.getEligibility.mockResolvedValue(
      eligibility({ voucherAvailable: true, cardCheckoutOpen: true, latestPayment: payment() })
    );
    renderPaymentScreen();

    await screen.findByRole("tab", { name: "Pay with a code" });
    fireEvent.press(screen.getByRole("tab", { name: "Pay with a code" }));

    expect(screen.getByText(/A card payment is open/)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Get my payment code" })).toBeOnTheScreen();
  });

  it("offers a new code once the old one has expired", async () => {
    const expired = voucher({ checkoutExpiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true, latestPayment: expired }));
    renderPaymentScreen();

    expect(await screen.findByText("This payment code has expired. Get a new one to pay.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Get a new payment code" })).toBeOnTheScreen();
  });

  it("shows the server's message when the code cannot be taken", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    paymentsClient.createVoucher.mockRejectedValue({ code: "CHECKOUT_UNAVAILABLE", message: "Payment codes are paused." });
    renderPaymentScreen();

    fireEvent.press(await screen.findByRole("button", { name: "Get my payment code" }));

    expect(await screen.findByText("Payment codes are paused.")).toBeOnTheScreen();
  });

  it("renders the payment code tab in Urdu", async () => {
    paymentsClient.getEligibility.mockResolvedValue(eligibility({ voucherAvailable: true }));
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("descon.language", "ur");
    renderPaymentScreen();

    expect(await screen.findByRole("button", { name: "میرا ادائیگی کا کوڈ حاصل کریں" })).toBeOnTheScreen();
  });
});
