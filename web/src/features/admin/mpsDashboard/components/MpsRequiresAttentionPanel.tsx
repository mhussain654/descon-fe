import { AlertTriangle, Clock } from 'lucide-react';
import type { DelayedCases } from '../../../../lib/admin-mps-dashboard-client';
import type { TFn } from '../../reports/components/ReportTables';
import { AttentionListPanel, type AttentionListItem } from '../../reports/components/AttentionListPanel';

/** The only two exception counts genuinely computed for MPS scope today -- critical and delayed cases (the same DelayedCasesQuery numbers the KPI row shows). No QVC/document follow-up rows: those would need new queries this pass doesn't build. */
export function MpsRequiresAttentionPanel({ delayedCases, t }: { delayedCases: DelayedCases; t: TFn }) {
  const items: AttentionListItem[] = [
    {
      key: 'critical',
      icon: AlertTriangle,
      label: t('mpsDashboardCritical'),
      hint: t('mpsDashboardAttentionCriticalHint'),
      count: delayedCases.critical,
    },
    {
      key: 'delayed',
      icon: Clock,
      label: t('mpsDashboardDelayed'),
      hint: t('mpsDashboardAttentionDelayedHint'),
      count: delayedCases.delayed,
    },
  ];

  return <AttentionListPanel items={items} emptyTitle={t('mpsDashboardRequiresAttentionEmpty')} />;
}
