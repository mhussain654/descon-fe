import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  Input,
  ValidationMessage,
  toast,
  type DataTableColumn,
} from '../../../../design-system';
import type { WorkflowStageRecord } from '../../../../lib/admin-reference-data-client';
import { useMobilizationProcesses, useUpdateWorkflowStage, useWorkflowStagesAdmin } from '../hooks/useReferenceDataAdmin';
import { ReferenceDataQueryState, referenceDataErrorMessage } from './ReferenceDataQueryState';

/** Workflow stage display names (editable) and each country's process steps (view only). */
export function WorkflowStagesSection() {
  const { t } = useLanguage();
  const stages = useWorkflowStagesAdmin();
  const [editing, setEditing] = useState<WorkflowStageRecord | null>(null);

  const columns: DataTableColumn<WorkflowStageRecord>[] = [
    { key: 'code', header: t('adminRefDataCode'), render: (row) => <span className="font-mono text-sm">{row.code}</span> },
    {
      key: 'nameEn',
      header: t('adminRefDataNameEn'),
      render: (row) => <StageName value={row.nameEn} fallback={row.defaultNameEn} customLabel={t('adminRefDataCustomName')} />,
    },
    {
      key: 'nameUr',
      header: t('adminRefDataNameUr'),
      render: (row) => (
        <span dir="rtl">
          <StageName value={row.nameUr} fallback={row.defaultNameUr} customLabel={t('adminRefDataCustomName')} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('adminRefDataActions'),
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
          {t('adminRefDataEdit')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <h2 className="font-semibold text-text-primary">{t('adminRefDataTabStages')}</h2>
        <p className="mb-4 text-xs text-text-secondary">{t('adminRefDataStagesHelp')}</p>
        <ReferenceDataQueryState query={stages}>
          {(rows) => <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={<EmptyState title={t('adminRefDataEmpty')} />} />}
        </ReferenceDataQueryState>
        <StageNameDialog stage={editing} onClose={() => setEditing(null)} />
      </Card>
      <ProcessesCard />
    </div>
  );
}

function StageName({ value, fallback, customLabel }: { value: string | null; fallback: string; customLabel: string }) {
  if (!value) return <span className="text-text-secondary">{fallback}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-text-primary">{value}</span>
      <Badge tone="info">{customLabel}</Badge>
    </span>
  );
}

function StageNameDialog({ stage, onClose }: { stage: WorkflowStageRecord | null; onClose: () => void }) {
  const { t } = useLanguage();
  const update = useUpdateWorkflowStage();
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');

  useEffect(() => {
    if (!stage) return;
    setNameEn(stage.nameEn ?? '');
    setNameUr(stage.nameUr ?? '');
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the form each time it opens
  }, [stage]);

  const submit = () => {
    if (!stage) return;
    update.mutate(
      { code: stage.code, nameEn, nameUr },
      {
        onSuccess: () => {
          toast.success(t('adminRefDataSaved'));
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={stage !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={t('adminRefDataStageEditTitle')} description={t('adminRefDataStageEditHelp')} closeLabel={t('adminRefDataCancel')}>
        <div className="space-y-4">
          <Input label={t('adminRefDataNameEn')} value={nameEn} maxLength={120} placeholder={stage?.defaultNameEn} onChange={(event) => setNameEn(event.target.value)} />
          <Input label={t('adminRefDataNameUr')} value={nameUr} maxLength={120} dir="rtl" placeholder={stage?.defaultNameUr} onChange={(event) => setNameUr(event.target.value)} />
          {update.isError ? <ValidationMessage tone="error">{referenceDataErrorMessage(update.error, t('adminRefDataSaveError'))}</ValidationMessage> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={update.isPending}>
            {t('adminRefDataCancel')}
          </Button>
          <Button type="button" onClick={submit} loading={update.isPending} disabled={update.isPending}>
            {t('adminRefDataSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProcessesCard() {
  const { t } = useLanguage();
  const processes = useMobilizationProcesses();
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="font-semibold text-text-primary">{t('adminRefDataProcessesTitle')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('adminRefDataProcessesHelp')}</p>
      <ReferenceDataQueryState query={processes}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState title={t('adminRefDataEmpty')} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {rows.map((process) => (
                <section key={`${process.code}-${process.version}`} className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{process.country?.name ?? t('adminRefDataChecklistCommon')}</h3>
                    <span className="font-mono text-xs text-text-secondary">
                      {process.code} v{process.version}
                    </span>
                    <Badge tone={process.status === 'active' ? 'success' : 'neutral'}>{process.status}</Badge>
                  </div>
                  <ol className="space-y-1 text-sm">
                    {process.stages.map((stage) => (
                      <li key={stage.position} className="flex gap-2">
                        <span className="w-6 shrink-0 text-end text-text-secondary">{stage.position}.</span>
                        <span className="text-text-primary">{stage.name}</span>
                        {!stage.required ? <span className="text-xs text-text-secondary">({t('adminRefDataLevelOptional')})</span> : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )
        }
      </ReferenceDataQueryState>
    </Card>
  );
}
