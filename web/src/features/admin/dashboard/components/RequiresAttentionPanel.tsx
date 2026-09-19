import { Link } from 'react-router';
import { EmptyState } from '../../../../design-system';
import type { RequiresAttentionRow } from '../../../../../../shared/adminDashboard/types';
import type { TFn } from '../../reports/components/ReportTables';
import { ATTENTION_HINT_KEYS, ATTENTION_ICON, ATTENTION_LABEL_KEYS, ATTENTION_LINK_PATH } from '../requiresAttentionMeta';

/** Cross-source exception counts (rejected documents, failed payments, overdue QVC, callback-required calls) as a scannable list -- icon, title, one-line hint, and (where a real target page exists) a link straight to the filtered queue. */
export function RequiresAttentionPanel({ rows, t }: { rows: RequiresAttentionRow[]; t: TFn }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return <EmptyState title={t('adminDashboardRequiresAttentionEmpty')} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border-default">
      {rows.map((row) => {
        const Icon = ATTENTION_ICON[row.code];
        const linkPath = ATTENTION_LINK_PATH[row.code];
        const content = (
          <>
            <div
              className={
                row.count > 0
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-subtle text-danger-emphasis'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-secondary'
              }
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-text-primary">{t(ATTENTION_LABEL_KEYS[row.code])}</div>
              <div className="text-xs text-text-secondary">{t(ATTENTION_HINT_KEYS[row.code])}</div>
            </div>
            <div className="text-xl font-bold text-text-primary">{row.count}</div>
          </>
        );

        return (
          <li key={row.code}>
            {linkPath ? (
              <Link to={linkPath} className="flex items-center gap-3 py-2.5 hover:bg-surface-sunken/60">
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-2.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
