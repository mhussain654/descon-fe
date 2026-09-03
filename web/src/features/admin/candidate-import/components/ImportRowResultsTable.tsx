import { Badge, DataTable } from '../../../../design-system';
import type { CandidateImportRowResult, CandidateImportRowStatus } from '../../../../lib/candidate-import-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

const ROW_STATUS_KEYS: Record<CandidateImportRowStatus, TranslationKey> = {
  accepted: 'adminCandidateImportRowStatusAccepted',
  committed: 'adminCandidateImportRowStatusCommitted',
  rejected: 'adminCandidateImportRowStatusRejected',
  skipped: 'adminCandidateImportRowStatusSkipped',
};

const ROW_STATUS_TONES: Record<CandidateImportRowStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  accepted: 'neutral',
  committed: 'success',
  rejected: 'danger',
  skipped: 'warning',
};

export interface ImportRowResultsTableProps {
  rowResults: CandidateImportRowResult[];
  t: (key: TranslationKey) => string;
}

/**
 * The batch detail's per-row outcome table (ticket: "Render final counts
 * and row results from the detail API only") -- distinct from
 * ImportRowErrorsTable (the preflight preview's table), since a row result
 * additionally carries a `status` (accepted/committed/rejected/skipped),
 * which nothing at preflight time has yet. Every `message` already arrived
 * localized from the backend -- rendered directly, never re-mapped from
 * `errorCode`. Never renders a full CNIC or mobile number -- a row result
 * only ever carries `rowNumber`/`status`/`errorField`/`errorCode`/
 * `message`, none of which can (AGENTS.md/ticket: "Do not display complete
 * CNICs or mobile numbers in import results").
 */
export function ImportRowResultsTable({ rowResults, t }: ImportRowResultsTableProps) {
  if (rowResults.length === 0) return null;

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{t('adminCandidateImportRowResultsTitle')}</h3>
      <DataTable
        columns={[
          { key: 'row', header: t('adminCandidateImportRowLabel'), render: (row) => row.rowNumber },
          {
            key: 'status',
            header: t('adminCandidateImportRowStatusColumnLabel'),
            render: (row) => <Badge tone={ROW_STATUS_TONES[row.status]}>{t(ROW_STATUS_KEYS[row.status])}</Badge>,
          },
          { key: 'field', header: t('adminCandidateImportRowFieldLabel'), render: (row) => row.errorField ?? '' },
          { key: 'message', header: t('adminCandidateImportRowMessageLabel'), render: (row) => row.message ?? '' },
        ]}
        rows={rowResults}
        getRowId={(row) => row.rowNumber}
      />
    </>
  );
}
