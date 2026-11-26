import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../../../contexts/LanguageContext';
import { CandidateDocumentsReview } from './CandidateDocumentsReview';

const summary = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../hooks/useCandidateDocumentSummary', () => ({
  useCandidateDocumentSummary: () => summary.current,
}));

// The review itself is SubmissionDetail's own (tested there); here we check which one is shown, and how.
vi.mock('../../documentReviews/components/SubmissionDetail', () => ({
  SubmissionDetail: ({ submissionId, embedded }: { submissionId: string; embedded?: boolean }) => (
    <div data-testid="submission-detail">{`${submissionId}:${embedded ? 'embedded' : 'page'}`}</div>
  ),
}));

const item = (id: string, submittedAt: string, reviewState: string) => ({
  id, submittedAt, review: { reviewState, pendingReview: 0, verified: 0, rejected: 0, requiredTotal: 0 },
  candidate: { id: 'cand-1', fullName: 'Ahmed Ali' }, assignment: {},
});

function renderReview() {
  return render(
    <LanguageProvider>
      <CandidateDocumentsReview candidateId="cand-1" />
    </LanguageProvider>
  );
}

describe('CandidateDocumentsReview', () => {
  afterEach(() => {
    summary.current = {};
  });

  it('reviews the latest submission right here, embedded', () => {
    summary.current = { data: { items: [item('sub-2', '2026-11-20T10:00:00Z', 'pending_review')] }, isLoading: false };

    renderReview();

    expect(screen.getByTestId('submission-detail')).toHaveTextContent('sub-2:embedded');
    expect(screen.queryByLabelText('Submission')).not.toBeInTheDocument();
  });

  it('lets staff switch between submissions, latest first', () => {
    summary.current = {
      data: { items: [item('sub-2', '2026-11-20T10:00:00Z', 'pending_review'), item('sub-1', '2026-11-10T10:00:00Z', 'changes_required')] },
      isLoading: false,
    };

    renderReview();
    expect(screen.getByTestId('submission-detail')).toHaveTextContent('sub-2:embedded');

    fireEvent.change(screen.getByLabelText('Submission'), { target: { value: 'sub-1' } });

    expect(screen.getByTestId('submission-detail')).toHaveTextContent('sub-1:embedded');
  });

  it('says when nothing has been submitted yet', () => {
    summary.current = { data: { items: [] }, isLoading: false };

    renderReview();

    expect(screen.getByText('No document submissions yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('submission-detail')).not.toBeInTheDocument();
  });

  it('shows nothing to staff who cannot review documents', () => {
    summary.current = { error: { code: 'FORBIDDEN' }, isError: true, isLoading: false };

    const { container } = renderReview();

    expect(container).toBeEmptyDOMElement();
  });
});
