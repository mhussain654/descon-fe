import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminPaymentsClient } from '../../../../lib/admin-payments-client';
import { PaymentDetail } from './PaymentDetail';

vi.mock('../../../../lib/admin-payments-client', () => ({
  adminPaymentsClient: {
    listPayments: vi.fn(),
    getPayment: vi.fn(),
    correctPayment: vi.fn(),
  },
}));

const FINANCE = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'finance' && !account.locked && !account.suspended)!;
const MANAGEMENT = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'management')!;

async function signedInClient(account: typeof FINANCE) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function paymentDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    candidate: { id: 'candidate-1', fullName: 'Ahmed Ali', maskedCnic: '42101-*******-1', referenceNumber: 'DES-001001' },
    paymentTypeCode: 'onboarding_fee',
    status: 'paid' as const,
    amount: '1500.00',
    currencyCode: 'PKR',
    provider: 'kuickpay',
    externalReference: 'KP-1',
    reconciliationState: 'clean' as const,
    paidAt: '2026-09-01T10:05:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:05:00Z',
    paymentEvents: [],
    reconciliationFindings: [],
    ...overrides,
  };
}

async function renderDetail(account = FINANCE, paymentId = 'payment-1') {
  const client = await signedInClient(account);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <PaymentDetail paymentId={paymentId} />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...result, client };
}

describe('PaymentDetail', () => {
  afterEach(() => {
    vi.mocked(adminPaymentsClient.getPayment).mockReset();
    vi.mocked(adminPaymentsClient.correctPayment).mockReset();
    sessionStorage.clear();
  });

  describe('states', () => {
    it('shows a loading state, then the payment detail', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      await renderDetail();

      expect(await screen.findByText('Payment details')).toBeInTheDocument();
      expect(screen.getByText('Ahmed Ali')).toBeInTheDocument();
      expect(screen.getByText('DES-001001')).toBeInTheDocument();
      expect(screen.getByText('42101-*******-1')).toBeInTheDocument();
      expect(screen.getByText(/^Rs\s*1,500$/)).toBeInTheDocument();
      expect(screen.getByText('onboarding_fee')).toBeInTheDocument();
      expect(screen.getByText('kuickpay')).toBeInTheDocument();
      expect(screen.getByText('KP-1')).toBeInTheDocument();
      expect(adminPaymentsClient.getPayment).toHaveBeenCalledWith('payment-1');
    });

    it('shows "Not set" when there is no external reference yet', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail({ externalReference: undefined, status: 'checkout_pending', paidAt: undefined }));
      await renderDetail();

      expect(await screen.findByText('Not set')).toBeInTheDocument();
    });

    it('shows a not-found state for an unknown payment', async () => {
      adminPaymentsClient.getPayment.mockRejectedValue({ code: 'NOT_FOUND' });
      await renderDetail();

      expect(await screen.findByText('Payment not found')).toBeInTheDocument();
      expect(screen.getByText('This payment may have been removed, or the link may be incorrect.')).toBeInTheDocument();
    });

    it('shows a forbidden state for a 403', async () => {
      adminPaymentsClient.getPayment.mockRejectedValue({ code: 'FORBIDDEN' });
      await renderDetail();

      expect(await screen.findByText('You do not have permission to view this page.')).toBeInTheDocument();
    });

    it('shows an offline state with retry', async () => {
      adminPaymentsClient.getPayment.mockRejectedValue({ code: 'OFFLINE' });
      await renderDetail();

      expect(await screen.findByText('You are offline')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('shows a generic error with retry for a server error', async () => {
      adminPaymentsClient.getPayment.mockRejectedValue({ code: 'SERVER_ERROR' });
      await renderDetail();

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      fireEvent.click(retryButton);
      expect(await screen.findByText('Ahmed Ali')).toBeInTheDocument();
    });

    it('signs the staff member out on a confirmed-expired staff session', async () => {
      adminPaymentsClient.getPayment.mockRejectedValue({ code: 'SESSION_EXPIRED' });
      const { client } = await renderDetail();
      const signOutSpy = vi.spyOn(client, 'signOut');

      await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    });
  });

  describe('safe event/finding rendering', () => {
    it('never renders a raw CNIC anywhere on the page', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      await renderDetail();

      await screen.findByText('Ahmed Ali');
      expect(document.body.textContent).not.toMatch(/\d{5}-\d{7}-\d(?!.*\*)/);
    });

    it('renders payment events with type, source and actor, never a raw payload', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          paymentEvents: [
            { id: 'evt-1', eventType: 'payment_succeeded', eventSource: 'callback', occurredAt: '2026-09-01T10:05:00Z' },
            {
              id: 'evt-2',
              eventType: 'payment_corrected',
              eventSource: 'admin_correction',
              occurredAt: '2026-09-02T09:00:00Z',
              actor: { id: 'staff-1', role: 'finance' },
            },
          ],
        })
      );
      await renderDetail();

      expect(await screen.findByText('Payment succeeded')).toBeInTheDocument();
      expect(screen.getByText('Payment corrected')).toBeInTheDocument();
      expect(screen.getByText(/Provider callback/)).toBeInTheDocument();
      expect(screen.getByText(/Staff correction/)).toBeInTheDocument();
      expect(screen.getByText(/finance/)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/secret|signature|payload/i);
    });

    it('shows an empty state when there are no events yet', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail({ paymentEvents: [] }));
      await renderDetail();

      expect(await screen.findByText('No events recorded yet.')).toBeInTheDocument();
    });

    it('renders an unrecognized event_type/event_source by humanizing it, not crashing', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          paymentEvents: [
            { id: 'evt-3', eventType: 'provider_webhook_retried', eventSource: 'manual_reconciliation', occurredAt: '2026-09-01T10:05:00Z' },
          ],
        })
      );
      await renderDetail();

      expect(await screen.findByText('Provider Webhook Retried')).toBeInTheDocument();
      expect(screen.getByText(/Manual Reconciliation/)).toBeInTheDocument();
    });

    it('shows an empty state when there are no reconciliation findings', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail({ reconciliationFindings: [] }));
      await renderDetail();

      expect(await screen.findByText('No reconciliation findings for this payment.')).toBeInTheDocument();
    });

    it('renders an open finding with an Investigate action for a manage_payments staff member', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          reconciliationFindings: [
            { id: 'finding-1', findingCode: 'external_reference_missing', state: 'open', createdAt: '2026-09-01T12:00:00Z' },
          ],
        })
      );
      await renderDetail(FINANCE);

      expect(await screen.findByText('Missing external reference')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Investigate' })).toBeInTheDocument();
    });

    it('hides the Investigate action for a staff member without manage_payments', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          reconciliationFindings: [
            { id: 'finding-1', findingCode: 'external_reference_missing', state: 'open', createdAt: '2026-09-01T12:00:00Z' },
          ],
        })
      );
      await renderDetail(MANAGEMENT);

      await screen.findByText('Missing external reference');
      expect(screen.queryByRole('button', { name: 'Investigate' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Correct this payment' })).not.toBeInTheDocument();
    });

    it('renders a resolved finding with its resolver and resolution note', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          reconciliationFindings: [
            {
              id: 'finding-1',
              findingCode: 'paid_at_missing',
              state: 'resolved',
              resolvedAt: '2026-09-02T09:00:00Z',
              resolvedBy: { id: 'staff-1', role: 'finance' },
              resolutionNote: 'Backfilled from provider dashboard.',
              createdAt: '2026-09-01T12:00:00Z',
            },
          ],
        })
      );
      await renderDetail();

      expect(await screen.findByText('Missing paid date')).toBeInTheDocument();
      expect(screen.getByText('Resolved', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText(/finance/)).toBeInTheDocument();
      expect(screen.getByText(/Backfilled from provider dashboard\./)).toBeInTheDocument();
    });
  });

  describe('correction flow', () => {
    it('allows a manage_payments staff member to submit and confirm a correction', async () => {
      const payment = paymentDetail({ externalReference: undefined });
      // The mutation both seeds the cache optimistically AND invalidates it
      // (so a real refetch confirms the correction) -- the second
      // getPayment call (from that invalidation-triggered refetch) must
      // also reflect the corrected value, matching what a real backend
      // round-trip would return.
      adminPaymentsClient.getPayment.mockResolvedValueOnce(payment).mockResolvedValue(paymentDetail({ externalReference: 'EXT-NEW' }));
      adminPaymentsClient.correctPayment.mockResolvedValue(paymentDetail({ externalReference: 'EXT-NEW' }));
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Backfilling from provider dashboard.' } });
      fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'EXT-NEW' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));

      expect(await screen.findByText('Confirm this correction?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm correction' }));

      await waitFor(() => expect(adminPaymentsClient.correctPayment).toHaveBeenCalledTimes(1));
      const [paymentId, correction, idempotencyKey] = adminPaymentsClient.correctPayment.mock.calls[0];
      expect(paymentId).toBe('payment-1');
      expect(correction).toMatchObject({
        reason: 'Backfilling from provider dashboard.',
        expectedUpdatedAt: payment.updatedAt,
        field: 'external_reference',
        value: 'EXT-NEW',
      });
      expect(idempotencyKey).toEqual(expect.any(String));

      await waitFor(() => expect(screen.getByText('EXT-NEW')).toBeInTheDocument());
      expect(screen.queryByText('Confirm this correction?')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();
    });

    it('requires a reason before opening the confirm dialog', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));

      expect(await screen.findByText('Enter a reason for this correction.')).toBeInTheDocument();
      expect(screen.queryByText('Confirm this correction?')).not.toBeInTheDocument();
      expect(adminPaymentsClient.correctPayment).not.toHaveBeenCalled();
    });

    it('requires a value when a field is selected', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'A valid reason.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));

      expect(await screen.findByText('Enter a new value.')).toBeInTheDocument();
    });

    it('retries with the same idempotency key after a failed attempt, and shows the error inside the dialog', async () => {
      adminPaymentsClient.getPayment
        .mockResolvedValueOnce(paymentDetail({ externalReference: undefined }))
        .mockResolvedValue(paymentDetail({ externalReference: 'EXT-NEW' }));
      adminPaymentsClient.correctPayment
        .mockRejectedValueOnce({ code: 'SERVER_ERROR' })
        .mockResolvedValueOnce(paymentDetail({ externalReference: 'EXT-NEW' }));
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Backfilling.' } });
      fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'EXT-NEW' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }));

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm correction' }));

      await waitFor(() => expect(adminPaymentsClient.correctPayment).toHaveBeenCalledTimes(2));
      const [, , firstKey] = adminPaymentsClient.correctPayment.mock.calls[0];
      const [, , secondKey] = adminPaymentsClient.correctPayment.mock.calls[1];
      expect(firstKey).toBe(secondKey);
      await waitFor(() => expect(screen.getByText('EXT-NEW')).toBeInTheDocument());
    });

    it('shows a stale-payment conflict distinctly, so the staff member knows to refresh', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail({ externalReference: undefined }));
      adminPaymentsClient.correctPayment.mockRejectedValue({
        code: 'STALE_PAYMENT',
        message: 'This payment changed before this correction could be applied. Refresh and try again.',
      });
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Backfilling.' } });
      fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'EXT-NEW' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }));

      expect(await screen.findByText('This payment changed before this correction could be applied. Refresh and try again.')).toBeInTheDocument();
    });

    it('shows a correction-not-allowed error distinctly', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail({ status: 'checkout_pending', paidAt: undefined }));
      adminPaymentsClient.correctPayment.mockRejectedValue({ code: 'CORRECTION_NOT_ALLOWED' });
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Trying an unsupported correction.' } });
      fireEvent.change(screen.getByLabelText('New value'), { target: { value: 'EXT-NEW' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }));

      expect(await screen.findByText('This correction is not allowed for this payment.')).toBeInTheDocument();
    });

    it('cancelling the correction form discards the draft', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Correct this payment' }));
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'A reason.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Correct this payment' })).toBeInTheDocument();
    });

    it('resolves a finding via its Investigate action, tying the correction to that finding', async () => {
      const openFindingPayment = paymentDetail({
        reconciliationFindings: [
          { id: 'finding-1', findingCode: 'paid_at_missing', state: 'open', createdAt: '2026-09-01T12:00:00Z' },
        ],
      });
      const resolvedFindingPayment = paymentDetail({
        reconciliationFindings: [
          {
            id: 'finding-1',
            findingCode: 'paid_at_missing',
            state: 'resolved',
            resolvedAt: '2026-09-02T09:00:00Z',
            resolvedBy: { id: 'staff-1', role: 'finance' },
            resolutionNote: 'Backfilled.',
            createdAt: '2026-09-01T12:00:00Z',
          },
        ],
      });
      adminPaymentsClient.getPayment.mockResolvedValueOnce(openFindingPayment).mockResolvedValue(resolvedFindingPayment);
      adminPaymentsClient.correctPayment.mockResolvedValue(resolvedFindingPayment);
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Investigate' }));
      // Only paid_at is offered for this finding code -- field defaults to it, no "note only" option needed to select it explicitly.
      fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Backfilled.' } });
      fireEvent.change(screen.getByLabelText('New value'), { target: { value: '2026-08-31T10:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Review correction' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }));

      await waitFor(() => expect(adminPaymentsClient.correctPayment).toHaveBeenCalledTimes(1));
      const [, correction] = adminPaymentsClient.correctPayment.mock.calls[0];
      expect(correction).toMatchObject({ findingId: 'finding-1', field: 'paid_at' });
      expect(await screen.findByText('Resolved', { selector: 'span' })).toBeInTheDocument();
    });

    it('offers only a note-only resolution for workflow_payment_mismatch, no field to correct', async () => {
      adminPaymentsClient.getPayment.mockResolvedValue(
        paymentDetail({
          reconciliationFindings: [
            { id: 'finding-1', findingCode: 'workflow_payment_mismatch', state: 'open', createdAt: '2026-09-01T12:00:00Z' },
          ],
        })
      );
      await renderDetail(FINANCE);

      fireEvent.click(await screen.findByRole('button', { name: 'Investigate' }));

      expect(screen.getByText('Nothing to change -- just resolve this finding')).toBeInTheDocument();
      expect(screen.queryByLabelText('New value')).not.toBeInTheDocument();
    });
  });

  it('renders in Urdu', async () => {
    adminPaymentsClient.getPayment.mockResolvedValue(paymentDetail());
    window.localStorage.setItem('descon.language', 'ur');
    await renderDetail();

    expect(await screen.findByRole('heading', { name: 'ادائیگی کی تفصیلات' })).toBeInTheDocument();
    window.localStorage.removeItem('descon.language');
  });
});
