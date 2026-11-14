import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminWorkflowCorrectionsClient } from '../../../../lib/admin-workflow-corrections-client';
import type { WorkflowCorrections } from '../../../../lib/admin-workflow-corrections-client';
import { WorkflowCorrectionsCard } from './WorkflowCorrectionsCard';

vi.mock('../../../../lib/admin-workflow-corrections-client', () => ({
  adminWorkflowCorrectionsClient: {
    getCorrections: vi.fn(),
    correctMedicalAppointment: vi.fn(),
    correctQvcAppointment: vi.fn(),
    correctFlightDetail: vi.fn(),
    correctVisaCopy: vi.fn(),
  },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;

function corrections(overrides: Partial<WorkflowCorrections> = {}): WorkflowCorrections {
  return {
    candidateId: 'candidate-1',
    medicalAppointment: {
      values: { centerName: 'Old Centre', centerAddress: null, appointmentDate: '2026-11-20', appointmentTime: '09:30' },
      editable: true,
      blockedReason: null,
      recentChanges: [],
    },
    qvcAppointment: {
      values: { centerName: null, centerAddress: null, appointmentDate: null, appointmentTime: null, attemptNumber: null },
      editable: false,
      blockedReason: 'not_recorded',
      recentChanges: [],
    },
    flightDetail: {
      values: { airline: 'PIA', flightNumber: 'PK-283', sector: null, flightDate: '2026-12-10T14:30:00+05:00', hasTicket: true },
      editable: false,
      blockedReason: 'mobilized',
      recentChanges: [],
    },
    visaCopy: {
      values: { outcomeCode: 'issued', decisionDate: '2026-11-14', hasVisaCopy: true, visaCopyStored: false },
      editable: true,
      blockedReason: null,
      recentChanges: [],
    },
    ...overrides,
  };
}

/** The mock admin plus `extraPermissions` (the developer-only permission is not on any mock account). */
function withPermissions(client: ReturnType<typeof createMockStaffAuthClient>, extraPermissions: string[]) {
  const widen = <T extends { permissions: string[] } | null>(session: T): T =>
    session ? { ...session, permissions: [...session.permissions, ...extraPermissions] } : session;
  return {
    ...client,
    signIn: async (credentials: Parameters<typeof client.signIn>[0]) => widen(await client.signIn(credentials)),
    restoreSession: async () => widen(await client.restoreSession()),
  };
}

async function renderCard(extraPermissions: string[] = ['correct_workflow_details']) {
  const client = withPermissions(createMockStaffAuthClient({ delayMs: 0 }), extraPermissions);
  await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <StaffAuthProvider client={client}>
          <WorkflowCorrectionsCard candidateId="candidate-1" />
        </StaffAuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

describe('WorkflowCorrectionsCard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000/api/v1');
    vi.mocked(adminWorkflowCorrectionsClient.getCorrections).mockResolvedValue(corrections());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('is hidden, and fetches nothing, for staff without the developer permission', async () => {
    const { container } = await renderCard([]);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(adminWorkflowCorrectionsClient.getCorrections).not.toHaveBeenCalled();
  });

  it('shows each box, keeping a blocked Change button visible but disabled with the reason', async () => {
    await renderCard();

    const medical = await screen.findByRole('region', { name: 'Medical appointment' });
    expect(within(medical).getByText('Old Centre')).toBeInTheDocument();
    expect(within(medical).getByRole('button', { name: 'Change' })).toBeEnabled();

    const qvc = screen.getByRole('region', { name: 'QVC appointment' });
    expect(within(qvc).getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(within(qvc).getByText('Nothing recorded yet to change.')).toBeInTheDocument();

    const flight = screen.getByRole('region', { name: 'Flight details' });
    expect(within(flight).getByText('PIA PK-283')).toBeInTheDocument();
    expect(within(flight).queryByText(/Route/)).not.toBeInTheDocument();
    expect(within(flight).getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(within(flight).getByText('The candidate is already mobilized.')).toBeInTheDocument();
  });

  it('needs a reason, then saves the change with the SMS choice', async () => {
    vi.mocked(adminWorkflowCorrectionsClient.correctMedicalAppointment).mockResolvedValue(corrections());
    await renderCard();

    const medical = await screen.findByRole('region', { name: 'Medical appointment' });
    fireEvent.click(within(medical).getByRole('button', { name: 'Change' }));
    expect(await screen.findByLabelText('Centre')).toHaveValue('Old Centre');

    fireEvent.change(screen.getByLabelText('Centre'), { target: { value: 'Al Shifa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(await screen.findByText('Enter a reason.')).toBeInTheDocument();
    expect(adminWorkflowCorrectionsClient.correctMedicalAppointment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'Candidate cannot reach it' } });
    fireEvent.click(screen.getByLabelText('Send SMS to candidate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));

    await waitFor(() =>
      expect(adminWorkflowCorrectionsClient.correctMedicalAppointment).toHaveBeenCalledWith({
        candidateId: 'candidate-1', reason: 'Candidate cannot reach it', notifyCandidate: false,
        centerName: 'Al Shifa', centerAddress: '', appointmentDate: '2026-11-20', appointmentTime: '09:30',
      })
    );
    await waitFor(() => expect(screen.queryByText('Change medical appointment')).not.toBeInTheDocument());
  });

  it('flags a visa copy missing from storage and replaces it with a new file and a reason, without the SMS choice', async () => {
    vi.mocked(adminWorkflowCorrectionsClient.correctVisaCopy).mockResolvedValue(corrections());
    await renderCard();

    const visa = await screen.findByRole('region', { name: 'Visa copy' });
    expect(within(visa).getByText('File missing from storage. Upload it again.')).toBeInTheDocument();
    fireEvent.click(within(visa).getByRole('button', { name: 'Change' }));

    expect(await screen.findByText('No SMS is sent for a new visa copy.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send SMS to candidate')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'Wrong file uploaded' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(await screen.findByText('Choose the visa file.')).toBeInTheDocument();
    expect(adminWorkflowCorrectionsClient.correctVisaCopy).not.toHaveBeenCalled();

    const file = new File(['%PDF-1.4'], 'visa.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/New visa copy/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));

    await waitFor(() =>
      expect(adminWorkflowCorrectionsClient.correctVisaCopy).toHaveBeenCalledWith({
        candidateId: 'candidate-1', reason: 'Wrong file uploaded', visaCopy: file,
      })
    );
  });

  it('keeps the visa Change button disabled when the latest decision is a rejection', async () => {
    vi.mocked(adminWorkflowCorrectionsClient.getCorrections).mockResolvedValue(
      corrections({
        visaCopy: {
          values: { outcomeCode: 'rejected', decisionDate: '2026-11-14', hasVisaCopy: false, visaCopyStored: null },
          editable: false,
          blockedReason: 'visa_rejected',
          recentChanges: [],
        },
      })
    );
    await renderCard();

    const visa = await screen.findByRole('region', { name: 'Visa copy' });
    expect(within(visa).getByRole('button', { name: 'Change' })).toBeDisabled();
    expect(within(visa).getByText('The latest visa decision is a rejection.')).toBeInTheDocument();
  });

  it('keeps the dialog open and shows the server message when the change is refused', async () => {
    vi.mocked(adminWorkflowCorrectionsClient.correctMedicalAppointment).mockRejectedValue({
      code: 'VALIDATION_FAILED', message: 'The candidate is past the medical stage, so the appointment can no longer be changed.',
    });
    await renderCard();

    const medical = await screen.findByRole('region', { name: 'Medical appointment' });
    fireEvent.click(within(medical).getByRole('button', { name: 'Change' }));
    fireEvent.change(await screen.findByLabelText('Reason for the change'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));

    expect(await screen.findByText(/can no longer be changed/)).toBeInTheDocument();
    expect(screen.getByText('Change medical appointment')).toBeInTheDocument();
  });
});
