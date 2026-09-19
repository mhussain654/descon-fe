import { AlertTriangle, Ban, PhoneMissed, XCircle } from 'lucide-react';
import { EmptyState, StatTile } from '../../../../design-system';
import { TONE_TILE_CLASSNAME } from '../../reports/components/ReportCharts';
import type { RequiresAttentionCode, RequiresAttentionRow } from '../../../../../../shared/adminDashboard/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { TFn } from '../../reports/components/ReportTables';

const ATTENTION_LABEL_KEYS: Record<RequiresAttentionCode, TranslationKey> = {
  rejected_documents: 'adminDashboardAttentionRejectedDocuments',
  failed_payment: 'adminDashboardAttentionFailedPayments',
  overdue_qvc: 'adminDashboardAttentionOverdueQvc',
  callback_required: 'adminDashboardAttentionCallbackRequired',
};

const ATTENTION_ICON: Record<RequiresAttentionCode, typeof AlertTriangle> = {
  rejected_documents: XCircle,
  failed_payment: Ban,
  overdue_qvc: AlertTriangle,
  callback_required: PhoneMissed,
};

/** Cross-source exception counts (rejected documents, failed payments, overdue QVC, callback-required calls) -- a tile is only tinted danger once its count is actually non-zero, so an all-clear panel doesn't look alarming. */
export function RequiresAttentionPanel({ rows, t }: { rows: RequiresAttentionRow[]; t: TFn }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return <EmptyState title={t('adminDashboardRequiresAttentionEmpty')} />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((row) => {
        const Icon = ATTENTION_ICON[row.code];
        return (
          <StatTile
            key={row.code}
            value={row.count}
            label={t(ATTENTION_LABEL_KEYS[row.code])}
            className={row.count > 0 ? TONE_TILE_CLASSNAME.danger : TONE_TILE_CLASSNAME.neutral}
            icon={<Icon />}
          />
        );
      })}
    </div>
  );
}
