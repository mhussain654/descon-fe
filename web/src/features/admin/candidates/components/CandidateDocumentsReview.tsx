import { useEffect, useState } from 'react';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Card, LoadingState, RetryBanner, Select } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { REVIEW_STATE_KEYS, REVIEW_STATE_TONES } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import { SubmissionDetail } from '../../documentReviews/components/SubmissionDetail';
import { useCandidateDocumentSummary } from '../hooks/useCandidateDocumentSummary';

/**
 * The candidate's Documents tab: their submission reviewed right here -- the
 * same document list, preview and verify/reject as Document reviews -- so
 * staff never leave the candidate. A candidate who resubmitted gets a picker,
 * latest first.
 */
export function CandidateDocumentsReview({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const query = useCandidateDocumentSummary(candidateId);
  const items = query.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Follow the latest submission until staff pick another one.
  useEffect(() => {
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  // Staff who cannot review documents see nothing here (as in the summary card).
  if (query.error?.code === 'FORBIDDEN' || query.error?.code === 'REVIEW_NOT_ALLOWED') return null;
  if (query.isLoading) return <LoadingState message={t('loading')} />;

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const optionLabel = (item: (typeof items)[number]) =>
    `${formatDate(item.submittedAt, language, { dateStyle: 'medium' })} · ${t(REVIEW_STATE_KEYS[item.review.reviewState] as TranslationKey)}`;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidateDocumentsSectionTitle')}</h2>
          {selected ? (
            <Badge tone={REVIEW_STATE_TONES[selected.review.reviewState]}>
              {t(REVIEW_STATE_KEYS[selected.review.reviewState] as TranslationKey)}
            </Badge>
          ) : null}
        </div>
        {query.isError ? (
          <div className="mt-3">
            <RetryBanner message={t('adminCandidateListLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
          </div>
        ) : null}
        {!query.isError && !selected ? (
          <p className="mt-2 text-sm text-text-tertiary">{t('adminCandidateDocumentsNoSubmissions')}</p>
        ) : null}
        {items.length > 1 ? (
          <div className="mt-3 max-w-sm">
            <Select
              label={t('adminCandidateDocumentsSubmissionLabel')}
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
              options={items.map((item) => ({ value: item.id, label: optionLabel(item) }))}
            />
          </div>
        ) : null}
      </Card>
      {selected ? <SubmissionDetail key={selected.id} submissionId={selected.id} embedded /> : null}
    </div>
  );
}
