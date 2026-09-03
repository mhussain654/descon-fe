import { DataTable } from '../../../../design-system';
import type { CandidateImportRowError } from '../../../../lib/candidate-import-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

export interface ImportRowErrorsTableProps {
  errors: CandidateImportRowError[];
  t: (key: TranslationKey) => string;
}

/**
 * Shared row-error table for both the preflight preview and the commit
 * result -- same shape in both responses. Every `message` already arrived
 * localized from the backend -- rendered directly, never re-mapped from
 * `code`. Never renders a full CNIC or mobile number -- a row error only
 * ever carries `row`/`field`/`code`/`message`, none of which can (AGENTS.md/
 * ticket: "Do not display complete CNICs or mobile numbers in import
 * results").
 */
export function ImportRowErrorsTable({ errors, t }: ImportRowErrorsTableProps) {
  if (errors.length === 0) return null;

  return (
    <>
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{t('adminCandidateImportRowErrorsTitle')}</h3>
      <DataTable
        columns={[
          { key: 'row', header: t('adminCandidateImportRowLabel'), render: (error) => error.row },
          { key: 'field', header: t('adminCandidateImportRowFieldLabel'), render: (error) => error.field },
          { key: 'message', header: t('adminCandidateImportRowMessageLabel'), render: (error) => error.message },
        ]}
        rows={errors}
        getRowId={(error) => `${error.row}-${error.field}-${error.code}`}
      />
    </>
  );
}
