import type { RequiresAttentionRow } from '../../../../../../shared/adminDashboard/types';
import type { TFn } from '../../reports/components/ReportTables';
import { AttentionListPanel, type AttentionListItem } from '../../reports/components/AttentionListPanel';
import { ATTENTION_HINT_KEYS, ATTENTION_ICON, ATTENTION_LABEL_KEYS, ATTENTION_LINK_PATH } from '../requiresAttentionMeta';

/** Cross-source exception counts (rejected documents, failed payments, overdue QVC, callback-required calls). */
export function RequiresAttentionPanel({ rows, t }: { rows: RequiresAttentionRow[]; t: TFn }) {
  const items: AttentionListItem[] = rows.map((row) => ({
    key: row.code,
    icon: ATTENTION_ICON[row.code],
    label: t(ATTENTION_LABEL_KEYS[row.code]),
    hint: t(ATTENTION_HINT_KEYS[row.code]),
    count: row.count,
    linkPath: ATTENTION_LINK_PATH[row.code],
  }));

  return <AttentionListPanel items={items} emptyTitle={t('adminDashboardRequiresAttentionEmpty')} />;
}
