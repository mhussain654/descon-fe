import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Card, ConfirmDialog, Select, Textarea } from '../../../../design-system';
import { Languages, Pencil } from 'lucide-react';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { WORKFLOW_STAGE_LABEL_KEYS } from '../../../../../../shared/adminWorkflow/canonicalStages';
import type { WorkflowStageCallScript } from '../../../../lib/admin-workflow-stage-call-scripts-client';
import { useUpdateWorkflowStageCallScript } from '../hooks/useUpdateWorkflowStageCallScript';

interface WorkflowStageCallScriptRowProps {
  script: WorkflowStageCallScript;
}

/**
 * One canonical workflow stage's call script, view mode by default with an
 * Edit action -- mirrors CandidateProfileCard.tsx's "toggle isEditing,
 * render a controlled form" pattern. Unlike that card, saving here can have
 * a real external side effect: turning `active` on (or changing the
 * wording of an already-active script) means every future candidate
 * entering this workflow stage automatically receives a billed AI voice
 * call using this content -- EditMode gates exactly those two cases behind
 * a confirmation step (see `needsConfirmation` there); a save that only
 * deactivates a script, or edits text while staying inactive, goes straight
 * through.
 */
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
    <Card className="h-full border-t-4 border-t-brand p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand"><Languages className="h-4 w-4" aria-hidden="true" /></span>
          <h3 className="text-sm font-semibold text-text-primary">{t(WORKFLOW_STAGE_LABEL_KEYS[script.workflowStageCode])}</h3>
          <Badge tone={script.active ? 'success' : 'neutral'}>
            {script.active ? t('adminWorkflowStageCallScriptActive') : t('adminWorkflowStageCallScriptInactive')}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('adminWorkflowStageCallScriptEditAction')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
          <p className="mb-1 text-xs font-medium text-text-tertiary">{t('adminWorkflowStageCallScriptLanguageEn')}</p>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{script.announcementEn}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
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
    </Card>
  );
}

function EditMode({ script, onDone }: { script: WorkflowStageCallScript; onDone: () => void }) {
  const { t } = useLanguage();
  const [announcementEn, setAnnouncementEn] = useState(script.announcementEn);
  const [announcementUr, setAnnouncementUr] = useState(script.announcementUr ?? '');
  const [active, setActive] = useState(script.active);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useUpdateWorkflowStageCallScript();

  const save = () => {
    mutation.mutate(
      { workflowStageCode: script.workflowStageCode, input: { announcementEn, announcementUr, active } },
      { onSuccess: onDone }
    );
  };

  // A save has a real external side effect -- future candidates entering
  // this workflow stage will automatically receive a billed AI voice call
  // -- exactly when the RESULTING state is active and either it wasn't
  // active before (activation) or the wording an active script speaks is
  // changing. Deactivating, or editing text while staying inactive, has no
  // such effect and saves immediately.
  const activating = active && !script.active;
  const changingActiveWording = active && script.active && (announcementEn !== script.announcementEn || announcementUr !== script.announcementUr);
  const needsConfirmation = activating || changingActiveWording;

  const handleSave = () => {
    if (needsConfirmation) {
      setConfirmOpen(true);
      return;
    }
    save();
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    save();
  };

  const errorMessage = mutation.isError && mutation.error.code === 'VALIDATION_FAILED' ? mutation.error.message : undefined;

  return (
    <Card className="h-full border-t-4 border-t-warning p-5 shadow-md">
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t(activating ? 'adminWorkflowStageCallScriptActivateConfirmTitle' : 'adminWorkflowStageCallScriptMessageChangeConfirmTitle')}
        description={t(
          activating ? 'adminWorkflowStageCallScriptActivateConfirmDescription' : 'adminWorkflowStageCallScriptMessageChangeConfirmDescription'
        )}
        confirmLabel={t('adminWorkflowStageCallScriptConfirmSaveAction')}
        cancelLabel={t('adminWorkflowStageCallScriptCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={handleConfirm}
        isConfirming={mutation.isPending}
      />
    </Card>
  );
}
