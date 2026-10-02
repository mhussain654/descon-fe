import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockStaffAuthClient, MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../../../../shared/auth/staffAuthClient';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { StaffAuthProvider } from '../../../../contexts/StaffAuthContext';
import { adminDocumentReviewsClient } from '../../../../lib/admin-document-reviews-client';
import { SubmissionDetail } from './SubmissionDetail';

vi.mock('../../../../lib/admin-document-reviews-client', () => ({
  adminDocumentReviewsClient: {
    getSubmission: vi.fn(),
    requestDocumentAccess: vi.fn(),
    verifyDocument: vi.fn(),
    rejectDocument: vi.fn(),
    getExtraction: vi.fn(),
  },
}));

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;

function submissionDocument(overrides: Record<string, unknown> = {}) {
  const document = {
    id: 'doc-1',
    requirementCode: 'passport',
    required: true,
    name: 'Passport',
    fileName: 'passport.pdf',
    contentType: 'application/pdf',
    fileSize: 123456,
    uploadedAt: '2026-08-19T12:00:00Z',
    status: 'pending_review' as const,
    ...overrides,
  };
  // One stored file mirroring the document's own fields, unless a test supplies its file set.
  const files = [
    { id: 'file-1', sideCode: null, position: 1, fileName: document.fileName, contentType: document.contentType, fileSize: document.fileSize },
  ];
  return { files, ...document };
}

function submissionDetail(documents: ReturnType<typeof submissionDocument>[]) {
  return {
    id: 'submission-1',
    candidate: { id: 'candidate-1', fullName: 'Ahmed Ali' },
    assignment: {
      id: 'assignment-1',
      referenceNumber: 'DES-001001',
      country: { code: 'pk', name: 'Pakistan' },
      project: { code: 'p1', name: 'Project One' },
      craft: { code: 'electrician', name: 'Electrician' },
    },
    submittedAt: '2026-08-19T12:00:00Z',
    review: { pendingReview: 1, verified: 0, rejected: 0, requiredTotal: 1, reviewState: 'pending_review' as const },
    documents,
  };
}

async function renderDetail() {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <SubmissionDetail submissionId="submission-1" />
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('SubmissionDetail', () => {
  afterEach(() => {
    vi.mocked(adminDocumentReviewsClient.getSubmission).mockReset();
    vi.mocked(adminDocumentReviewsClient.verifyDocument).mockReset();
    vi.mocked(adminDocumentReviewsClient.rejectDocument).mockReset();
    vi.mocked(adminDocumentReviewsClient.getExtraction).mockReset();
  });

  it('shows the extraction status and pre-fills issue/expiry inputs for an OCR-supported document, then submits the (possibly edited) dates', async () => {
    adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail([submissionDocument()]));
    adminDocumentReviewsClient.getExtraction.mockResolvedValue({
      status: 'succeeded',
      issuedOn: '2020-01-01',
      expiresOn: '2030-01-01',
      confidenceIssuedOn: 96.4,
    });
    adminDocumentReviewsClient.verifyDocument.mockResolvedValue({
      document: submissionDocument({ status: 'verified', issuedOn: '2020-01-01', expiresOn: '2030-06-01' }),
      submission: { id: 'submission-1', review: { pendingReview: 0, verified: 1, rejected: 0, requiredTotal: 1, reviewState: 'verified' } },
    });

    await renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('AI-extracted')).toBeInTheDocument();
    const issuedInput = (await screen.findByLabelText('Issued on')) as HTMLInputElement;
    const expiresInput = screen.getByLabelText('Expires on') as HTMLInputElement;
    await waitFor(() => expect(issuedInput.value).toBe('2020-01-01'));
    expect(expiresInput.value).toBe('2030-01-01');

    fireEvent.change(expiresInput, { target: { value: '2030-06-01' } });
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' });
    fireEvent.click(verifyButtons[verifyButtons.length - 1]);

    await waitFor(() =>
      expect(adminDocumentReviewsClient.verifyDocument).toHaveBeenCalledWith(
        'doc-1',
        expect.any(String),
        { issuedOn: '2020-01-01', expiresOn: '2030-06-01' }
      )
    );
  });

  it('does not show date inputs or fetch extraction data for a non-OCR document type', async () => {
    adminDocumentReviewsClient.getSubmission.mockResolvedValue(
      submissionDetail([submissionDocument({ id: 'doc-2', requirementCode: 'cv', name: 'CV' })])
    );
    adminDocumentReviewsClient.verifyDocument.mockResolvedValue({
      document: submissionDocument({ id: 'doc-2', requirementCode: 'cv', status: 'verified' }),
      submission: { id: 'submission-1', review: { pendingReview: 0, verified: 1, rejected: 0, requiredTotal: 1, reviewState: 'verified' } },
    });

    await renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));

    await screen.findByText('Verify this document?');
    expect(screen.queryByLabelText('Issued on')).not.toBeInTheDocument();
    expect(adminDocumentReviewsClient.getExtraction).not.toHaveBeenCalled();
  });

  it('still supports rejecting a document with a reason', async () => {
    adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail([submissionDocument()]));
    adminDocumentReviewsClient.rejectDocument.mockResolvedValue({
      document: submissionDocument({ status: 'rejected', rejectionReason: 'Blurry photo.' }),
      submission: { id: 'submission-1', review: { pendingReview: 0, verified: 0, rejected: 1, requiredTotal: 1, reviewState: 'changes_required' } },
    });

    await renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Blurry photo.' } });
    const rejectButtons = screen.getAllByRole('button', { name: 'Reject' });
    fireEvent.click(rejectButtons[rejectButtons.length - 1]);

    await waitFor(() => expect(adminDocumentReviewsClient.rejectDocument).toHaveBeenCalledWith('doc-1', 'Blurry photo.', expect.any(String)));
  });
  describe('multi-file documents', () => {
    const cnicFiles = [
      { id: 'file-front', sideCode: 'front', position: 1, fileName: 'front.jpg', contentType: 'image/jpeg', fileSize: 2048 },
      { id: 'file-back', sideCode: 'back', position: 2, fileName: 'back.jpg', contentType: 'image/jpeg', fileSize: 4096 },
    ];
    const cnicDocument = () =>
      submissionDocument({ id: 'doc-cnic', requirementCode: 'cnic', name: 'CNIC', fileName: 'front.jpg', files: cnicFiles });

    afterEach(() => vi.mocked(adminDocumentReviewsClient.requestDocumentAccess).mockReset());

    it('lists every file of the set with its part label and its own preview', async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail([cnicDocument()]));
      adminDocumentReviewsClient.requestDocumentAccess.mockResolvedValue({
        documentId: 'doc-cnic',
        fileId: 'file-back',
        url: '/rails/active_storage/blobs/proxy/abc/back.jpg',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });

      await renderDetail();

      const fileList = await screen.findByRole('list', { name: 'Files in this document' });
      expect(fileList).toHaveTextContent('Front');
      expect(fileList).toHaveTextContent('front.jpg');
      expect(fileList).toHaveTextContent('Back');
      expect(fileList).toHaveTextContent('back.jpg');

      fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[1]);

      await waitFor(() => expect(adminDocumentReviewsClient.requestDocumentAccess).toHaveBeenCalledWith('doc-cnic', 'file-back'));
      expect(await screen.findByRole('img', { name: 'back.jpg' })).toBeInTheDocument();
    });

    it('lets the reviewer switch between the files of the set inside the preview', async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail([cnicDocument()]));
      adminDocumentReviewsClient.requestDocumentAccess.mockImplementation(async (documentId: string, fileId?: string) => ({
        documentId,
        fileId: fileId ?? '',
        url: `/rails/active_storage/blobs/proxy/abc/${fileId}.jpg`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }));

      await renderDetail();
      fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]);
      expect(await screen.findByRole('img', { name: 'front.jpg' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(await screen.findByRole('img', { name: 'back.jpg' })).toBeInTheDocument();
      expect(adminDocumentReviewsClient.requestDocumentAccess).toHaveBeenLastCalledWith('doc-cnic', 'file-back');
    });

    it('verifies the whole set with one decision', async () => {
      adminDocumentReviewsClient.getSubmission.mockResolvedValue(submissionDetail([cnicDocument()]));
      adminDocumentReviewsClient.verifyDocument.mockResolvedValue({
        document: { ...cnicDocument(), status: 'verified' },
        submission: { id: 'submission-1', review: { pendingReview: 0, verified: 1, rejected: 0, requiredTotal: 1, reviewState: 'verified' } },
      });
      adminDocumentReviewsClient.getExtraction.mockResolvedValue({ status: 'not_started' });

      await renderDetail();
      expect(await screen.findAllByRole('button', { name: 'Verify' })).toHaveLength(1);
    });
  });
});
