import { Badge, Card, DataTable } from '../../../../design-system';
import type { CandidateImportResult } from '../../../../lib/candidate-import-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

export interface CandidateImportResultViewProps {
  result: CandidateImportResult;
  t: (key: TranslationKey) => string;
}

/**
 * Renders a completed import's outcome: counts, and any row-level problems.
 * Every row error's `message` already arrived localized from the backend
 * (see CandidateImportRowError) -- rendered directly, never re-mapped.
 * Never renders a full CNIC or mobile number -- the backend's row-level
 * errors only ever reference `row`/`field`/`code`/`message`, none of which
 * can carry one (AGENTS.md/ticket: "Do not display complete CNICs or mobile
 * numbers in import results").
 */
export function CandidateImportResultView({ result, t }: CandidateImportResultViewProps) {
  const title =
    result.successfulRows === 0
      ? t('adminCandidateImportEmptyResultTitle')
      : result.failedRows > 0 || result.skippedRows > 0
        ? t('adminCandidateImportMixedResultTitle')
        : t('adminCandidateImportSuccessTitle');

  const counts: Array<{ labelKey: TranslationKey; value: number; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = [
    { labelKey: 'adminCandidateImportTotalRowsLabel', value: result.totalRows, tone: 'neutral' },
    { labelKey: 'adminCandidateImportSuccessfulRowsLabel', value: result.successfulRows, tone: 'success' },
    { labelKey: 'adminCandidateImportFailedRowsLabel', value: result.failedRows, tone: 'danger' },
    { labelKey: 'adminCandidateImportSkippedRowsLabel', value: result.skippedRows, tone: 'warning' },
  ];

  return (
    <Card className="mb-5" role="status">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>

      {result.successfulRows === 0 ? (
        <p className="mb-4 text-sm text-text-secondary">{t('adminCandidateImportEmptyResultDescription')}</p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {counts.map((count) => (
          <Badge key={count.labelKey} tone={count.tone}>
            {t(count.labelKey)}: {count.value}
          </Badge>
        ))}
      </div>

      {result.errors.length > 0 ? (
        <>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">{t('adminCandidateImportRowErrorsTitle')}</h3>
          <DataTable
            columns={[
              {
                key: 'row',
                header: t('adminCandidateImportRowLabel'),
                render: (error) => error.row,
              },
              {
                key: 'field',
                header: t('adminCandidateImportRowFieldLabel'),
                render: (error) => error.field,
              },
              {
                key: 'message',
                header: t('adminCandidateImportRowMessageLabel'),
                render: (error) => error.message,
              },
            ]}
            rows={result.errors}
            getRowId={(error) => `${error.row}-${error.field}-${error.code}`}
          />
        </>
      ) : null}
    </Card>
  );
}
