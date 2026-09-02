import { Badge, Card } from '../../../../design-system';
import type { CandidateImportCommitResult } from '../../../../lib/candidate-import-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { ImportRowErrorsTable } from './ImportRowErrorsTable';

export interface CandidateImportResultViewProps {
  result: CandidateImportCommitResult;
  t: (key: TranslationKey) => string;
}

/**
 * Renders a committed import's outcome. The backend has no "partial"/
 * "failed" status distinct from `'committed'` (CandidateImportBatch has no
 * such state) -- completed/partial/failed here are UI-level categories
 * derived from `importedRows` vs. `totalRows`, not a field the backend
 * returns. Never renders a full CNIC or mobile number -- see
 * ImportRowErrorsTable's identical note.
 */
export function CandidateImportResultView({ result, t }: CandidateImportResultViewProps) {
  const title =
    result.importedRows === 0
      ? t('adminCandidateImportEmptyResultTitle')
      : result.rejectedRows > 0
        ? t('adminCandidateImportMixedResultTitle')
        : t('adminCandidateImportSuccessTitle');

  const counts: Array<{ labelKey: TranslationKey; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = [
    { labelKey: 'adminCandidateImportTotalRowsLabel', value: result.totalRows, tone: 'neutral' },
    { labelKey: 'adminCandidateImportSuccessfulRowsLabel', value: result.importedRows, tone: 'success' },
    { labelKey: 'adminCandidateImportFailedRowsLabel', value: result.failedRows, tone: 'danger' },
    { labelKey: 'adminCandidateImportSkippedRowsLabel', value: result.skippedRows, tone: 'warning' },
  ];

  return (
    <Card className="mb-5" role="status">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>

      {result.importedRows === 0 ? <p className="mb-4 text-sm text-text-secondary">{t('adminCandidateImportEmptyResultDescription')}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map((count) => (
          <Badge key={count.labelKey} tone={count.tone}>
            {t(count.labelKey)}: {count.value}
          </Badge>
        ))}
      </div>

      <ImportRowErrorsTable errors={result.errors} t={t} />
    </Card>
  );
}
