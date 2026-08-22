export default function PaymentPage() {
  const payment = {
    amount: 25000,
    status: "Pending",
    reference: "PAY-2026-001",
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA]">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <a href="/dashboard" className="mb-3 inline-block text-sm font-medium text-gray-500 hover:text-black">
            Back
          </a>
          <h1 className="text-3xl font-semibold text-black">Payment</h1>
          <p className="mt-1 text-sm text-gray-500">Complete your onboarding payment</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Reference Number</div>
              <div className="mt-1 text-base font-medium text-black">{payment.reference}</div>
            </div>
            <div className="rounded-xl bg-[#FFF7E6] px-3 py-2 text-sm font-semibold text-[#F59E0B]">
              {payment.status}
            </div>
          </div>

          <div className="mb-8 rounded-2xl bg-[#F8F9FA] p-5">
            <div className="text-sm text-gray-500">Amount Due</div>
            <div className="mt-2 text-4xl font-semibold text-black">
              PKR {payment.amount.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-[#0066CC] px-6 py-4 text-base font-semibold text-white transition hover:bg-[#0057AD]"
          >
            Pay Now
          </button>
        </div>
      </div>
    </main>
  );
}
