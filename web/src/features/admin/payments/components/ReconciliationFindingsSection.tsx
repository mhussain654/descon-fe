import { Badge, Button, Card } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { RECONCILIATION_FINDING_CODE_KEYS } from '../../../../../../shared/adminPayments/paymentLabels';
import { useLanguage } from '../../../../contexts/LanguageContext';
import type { ReconciliationFinding } from '../../../../lib/admin-payments-client';

export interface ReconciliationFindingsSectionProps {
  findings: ReconciliationFinding[];
  canCorrect: boolean;
  onInvestigate: (finding: ReconciliationFinding) => void;
}

/** This payment's own reconciliation findings (ticket: "Reconciliation findings section") -- never a separate reconciliation-run view, since every finding here already belongs to this one payment. */
export function ReconciliationFindingsSection({ findings, canCorrect, onInvestigate }: ReconciliationFindingsSectionProps) {
  const { t, language } = useLanguage();

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminFinancePaymentFindingsTitle')}</h2>
      {findings.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('adminFinancePaymentFindingsEmpty')}</p>
      ) : (
        <ul className="space-y-4">
          {findings.map((finding) => (
            <li key={finding.id} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-text-primary">{t(RECONCILIATION_FINDING_CODE_KEYS[finding.findingCode])}</span>
                <Badge tone={finding.state === 'open' ? 'warning' : 'neutral'}>
                  {t(finding.state === 'open' ? 'adminFinancePaymentFindingStateOpen' : 'adminFinancePaymentFindingStateResolved')}
                </Badge>
              </div>
              {finding.state === 'resolved' ? (
                <div className="text-sm text-text-secondary">
                  {finding.resolvedAt ? (
                    <p>
                      {t('adminFinancePaymentResolvedByLabel')}: {finding.resolvedBy?.role ?? t('notAvailable')} ({formatDate(finding.resolvedAt, language, { dateStyle: 'medium', timeStyle: 'short' })})
                    </p>
                  ) : null}
                  {finding.resolutionNote ? (
                    <p className="mt-1">
                      {t('adminFinancePaymentResolutionNoteLabel')}: {finding.resolutionNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {finding.state === 'open' && canCorrect ? (
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => onInvestigate(finding)}>
                    {t('adminFinancePaymentInvestigateAction')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
