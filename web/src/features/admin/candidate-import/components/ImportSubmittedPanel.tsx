import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, StatTile } from '../../../../design-system';
import { isTerminalImportStatus } from '../../../../../../shared/adminCandidateImport/pollingBackoff';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCandidateImportBatch } from '../hooks/useCandidateImportBatch';
import { ImportProgress } from './ImportProgress';

export interface ImportSubmittedPanelProps {
  importId: string;
  t: (key: TranslationKey) => string;
  onStartOver: () => void;
}

/**
 * Shown right after the staff member confirms an import: a prominent success
 * alert, then live progress straight from the batch detail API (the same
 * polling query the detail page uses), then the final counts once the
 * import finishes -- so nobody has to leave the page to see what happened.
 * The detail page stays the full record (row results, error export, retry).
 */
export function ImportSubmittedPanel({ importId, t, onStartOver }: ImportSubmittedPanelProps) {
  const query = useCandidateImportBatch(importId);
  const batch = query.data;
  const finished = batch ? isTerminalImportStatus(batch.status) : false;

  return (
    <div className="space-y-4">
      <div role="status" className="flex gap-3 rounded-2xl border border-success bg-success-subtle px-5 py-4 shadow-sm">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success-emphasis" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-success-emphasis">{t('adminCandidateImportConfirmedTitle')}</h2>
          <p className="mt-1 text-sm text-text-primary">{t('adminCandidateImportConfirmedDescription')}</p>
        </div>
      </div>

      <Card>
        {batch && !finished ? <ImportProgress batch={batch} t={t} /> : null}

        {batch && finished ? (
          <div aria-live="polite">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateImportFinishedTitle')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile value={batch.importedRows} label={t('adminCandidateImportSuccessfulRowsLabel')} />
              <StatTile value={batch.rejectedRows} label={t('adminCandidateImportRejectedResultLabel')} />
              <StatTile value={batch.skippedRows} label={t('adminCandidateImportSkippedRowsLabel')} />
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to={`/admin/candidates/import/${importId}`}
            className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            {t('adminCandidateImportViewDetails')}
          </Link>
          <Button type="button" variant="outline" onClick={onStartOver}>
            {t('adminCandidateImportAnotherFile')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
