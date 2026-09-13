import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Select, Textarea } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { WORKFLOW_STAGE_LABEL_KEYS } from '../../../../../../shared/adminWorkflow/canonicalStages';
import type { WorkflowStageCallScript } from '../../../../lib/admin-workflow-stage-call-scripts-client';
import { useUpdateWorkflowStageCallScript } from '../hooks/useUpdateWorkflowStageCallScript';

interface WorkflowStageCallScriptRowProps {
  script: WorkflowStageCallScript;
}

/** One canonical workflow stage's call script, view mode by default with an Edit action -- mirrors CandidateProfileCard.tsx's "toggle isEditing, render a controlled form" pattern, simplified: no confirm step, since editing content has no external side effect to guard. */
export function WorkflowStageCallScriptRow({ script }: WorkflowStageCallScriptRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    return <ViewMode script={script} onEdit={() => setIsEditing(true)} />;
  }

  return <EditMode script={script} onDone={() => setIsEditing(false)} />;
}

function ViewMode({ script, onEdit }: { script: WorkflowStageCallScript; onEdit: () => void }) {
  const { t, language } = useLanguage();

  return (
    <div className="border-b border-border-subtle py-5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{t(WORKFLOW_STAGE_LABEL_KEYS[script.workflowStageCode])}</h3>
          <Badge tone={script.active ? 'success' : 'neutral'}>
            {script.active ? t('adminWorkflowStageCallScriptActive') : t('adminWorkflowStageCallScriptInactive')}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          {t('adminWorkflowStageCallScriptEditAction')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-sunken p-3">
          <p className="mb-1 text-xs font-medium text-text-tertiary">{t('adminWorkflowStageCallScriptLanguageEn')}</p>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{script.announcementEn}</p>
        </div>
        <div className="rounded-lg bg-surface-sunken p-3">
          <p className="mb-1 text-xs font-medium text-text-tertiary">{t('adminWorkflowStageCallScriptLanguageUr')}</p>
          <p dir="rtl" className="whitespace-pre-wrap text-sm text-text-secondary">
            {script.announcementUr || <span className="italic text-text-tertiary">{t('adminWorkflowStageCallScriptNoUrduYet')}</span>}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        {t('adminWorkflowStageCallScriptUpdatedBy')}:{' '}
        {script.updatedBy ? `${script.updatedBy.role} (${script.updatedBy.id})` : t('adminCommunicationSystemActor')} ·{' '}
        {formatDate(script.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
    </div>
  );
}

function EditMode({ script, onDone }: { script: WorkflowStageCallScript; onDone: () => void }) {
  const { t } = useLanguage();
  const [announcementEn, setAnnouncementEn] = useState(script.announcementEn);
  const [announcementUr, setAnnouncementUr] = useState(script.announcementUr ?? '');
  const [active, setActive] = useState(script.active);
  const mutation = useUpdateWorkflowStageCallScript();

  const handleSave = () => {
    mutation.mutate(
      { workflowStageCode: script.workflowStageCode, input: { announcementEn, announcementUr, active } },
      { onSuccess: onDone }
    );
  };

  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <div className="border-b border-border-subtle py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t(WORKFLOW_STAGE_LABEL_KEYS[script.workflowStageCode])}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Textarea
            label={t('adminWorkflowStageCallScriptAnnouncementEnLabel')}
            value={announcementEn}
            onChange={(event) => setAnnouncementEn(event.target.value)}
            errorMessage={errorMessage}
            rows={4}
          />
          <Textarea
            label={t('adminWorkflowStageCallScriptAnnouncementUrLabel')}
            helperText={t('adminWorkflowStageCallScriptUrduOptionalHint')}
            value={announcementUr}
            onChange={(event) => setAnnouncementUr(event.target.value)}
            dir="rtl"
            rows={4}
          />
        </div>
        <Select
          label={t('adminWorkflowStageCallScriptActiveLabel')}
          value={active ? 'active' : 'inactive'}
          onChange={(event) => setActive(event.target.value === 'active')}
          options={[
            { value: 'active', label: t('adminWorkflowStageCallScriptActive') },
            { value: 'inactive', label: t('adminWorkflowStageCallScriptInactive') },
          ]}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone} disabled={mutation.isPending}>
          {t('adminWorkflowStageCallScriptCancelAction')}
        </Button>
        <Button size="sm" onClick={handleSave} loading={mutation.isPending}>
          {t('adminWorkflowStageCallScriptSaveAction')}
        </Button>
      </div>
    </div>
  );
}
