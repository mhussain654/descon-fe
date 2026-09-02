import { Link } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Card, RetryBanner } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { REVIEW_STATE_KEYS, REVIEW_STATE_TONES } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import { useCandidateDocumentSummary } from '../hooks/useCandidateDocumentSummary';

interface CandidateDocumentsSummaryCardProps {
  candidateId: string;
}

/**
 * "Links or summaries for documents and document review" (MPS-F303) --
 * reuses the existing admin document-review queue endpoint scoped to this
 * one candidate rather than a dedicated summary endpoint (none exists).
 * Document review already has its own real, dedicated feature
 * (/admin/document-reviews); this card only summarizes and links into it,
 * never reimplements review actions here.
 */
export function CandidateDocumentsSummaryCard({ candidateId }: CandidateDocumentsSummaryCardProps) {
  const { t, language } = useLanguage();
  const query = useCandidateDocumentSummary(candidateId);

  // A staff member without manage_candidate_documents simply doesn't see
  // this section -- they have no document-review destination to link to
  // either way, matching AGENTS.md's "frontend guards are UX only" while
  // avoiding a scary error banner for a permission gap that isn't
  // actionable from here.
  if (query.error?.code === 'FORBIDDEN' || query.error?.code === 'REVIEW_NOT_ALLOWED') {
    return null;
  }
  if (query.isLoading) {
    return null;
  }

  const items = query.data?.items ?? [];
  const latest = items[0];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidateDocumentsSectionTitle')}</h2>
        <Link to={`/admin/document-reviews?candidateId=${encodeURIComponent(candidateId)}`} className="text-sm font-medium text-brand hover:underline">
          {t('adminCandidateDocumentsViewAll')}
        </Link>
      </div>

      {query.isError ? (
        <div className="mb-3">
          <RetryBanner message={t('adminCandidateListLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}

      {!query.isError && !latest ? <p className="text-sm text-text-tertiary">{t('adminCandidateDocumentsNoSubmissions')}</p> : null}

      {latest ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={REVIEW_STATE_TONES[latest.review.reviewState]}>{t(REVIEW_STATE_KEYS[latest.review.reviewState])}</Badge>
          <span className="text-xs text-text-tertiary">
            {t('adminCandidateDocumentsSubmittedOn')}: {formatDate(latest.submittedAt, language, { dateStyle: 'medium' })}
          </span>
          <Link to={`/admin/document-reviews/${latest.id}`} className="text-sm font-medium text-brand hover:underline">
            {t('adminCandidateDocumentsViewSubmission')}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
