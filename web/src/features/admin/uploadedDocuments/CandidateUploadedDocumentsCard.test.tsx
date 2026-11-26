import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { adminUploadedDocumentsClient } from '../../../lib/admin-uploaded-documents-client';
import { CandidateUploadedDocumentsCard } from './CandidateUploadedDocumentsCard';

vi.mock('../../../lib/admin-uploaded-documents-client', () => ({
  adminUploadedDocumentsClient: { listUploadedDocuments: vi.fn(), openFile: vi.fn() },
}));

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CandidateUploadedDocumentsCard candidateId="cand-1" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

const passport = {
  id: 'doc-1', documentType: { code: 'passport', name: 'Passport' }, status: 'uploaded', submitted: false, uploadedAt: null,
  files: [{ id: 'file-1', sideCode: 'page_1', originalFilename: 'passport-page-1.jpg', contentType: 'image/jpeg', byteSize: 2048 }],
};
const cnic = { ...passport, id: 'doc-2', documentType: { code: 'cnic', name: 'CNIC' }, status: 'under_verification', submitted: true, files: [] };

describe('CandidateUploadedDocumentsCard', () => {
  afterEach(() => {
    vi.mocked(adminUploadedDocumentsClient.listUploadedDocuments).mockReset();
    vi.mocked(adminUploadedDocumentsClient.openFile).mockReset();
  });

  it('lists uploaded documents, saying which are not submitted yet, with no approve or reject', async () => {
    vi.mocked(adminUploadedDocumentsClient.listUploadedDocuments).mockResolvedValue([passport, cnic]);

    renderCard();

    expect(await screen.findByText('Passport')).toBeInTheDocument();
    expect(screen.getByText('Not submitted yet')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Under verification')).toBeInTheDocument();
    expect(screen.getByText(/passport-page-1\.jpg/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|verify|reject/i })).toBeNull();
  });

  it('opens a file through a short-lived link', async () => {
    vi.mocked(adminUploadedDocumentsClient.listUploadedDocuments).mockResolvedValue([passport]);
    vi.mocked(adminUploadedDocumentsClient.openFile).mockResolvedValue({ url: '', expiresAt: '2026-11-26T09:05:00Z' });

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: 'View passport-page-1.jpg' }));

    await waitFor(() => expect(adminUploadedDocumentsClient.openFile).toHaveBeenCalledWith('cand-1', 'doc-1', 'file-1'));
  });

  it('says when nothing is uploaded yet', async () => {
    vi.mocked(adminUploadedDocumentsClient.listUploadedDocuments).mockResolvedValue([]);

    renderCard();

    expect(await screen.findByText('The candidate has not uploaded any documents yet.')).toBeInTheDocument();
  });
});
