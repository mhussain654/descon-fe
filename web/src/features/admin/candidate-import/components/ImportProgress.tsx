import { ProgressBar } from '../../../../design-system';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CandidateImportBatchDetail } from '../../../../lib/candidate-import-client';

export interface ImportProgressProps {
  batch: CandidateImportBatchDetail;
  t: (key: TranslationKey) => string;
}

/**
 * Live progress for a confirmed import that's still queued or processing:
 * how many of the accepted rows the import job has worked through so far
 * (`acceptedRows - pendingRows`). The parent's detail query keeps polling
 * while the batch is queued/processing, so this updates on its own. Renders
 * nothing once the batch reaches any other status.
 */
export function ImportProgress({ batch, t }: ImportProgressProps) {
  if (batch.status !== 'queued' && batch.status !== 'processing') return null;

  const total = batch.acceptedRows;
  const processed = batch.pendingRows === null ? 0 : Math.max(total - batch.pendingRows, 0);
  const notStarted = batch.status === 'queued' && processed === 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const progressText = t('adminCandidateImportProgressText')
    .replace('%{processed}', String(processed))
    .replace('%{total}', String(total));

  return (
    <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
      <ProgressBar
        value={percent}
        label={t('adminCandidateImportProgressLabel')}
        displayText={notStarted ? t('adminCandidateImportWaitingToStart') : progressText}
      />
    </div>
  );
}
