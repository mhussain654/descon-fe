import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Card, ConfirmDialog, Input, Select } from '../../../../design-system';
import { Mic, Pencil } from 'lucide-react';
import { formatDate } from '../../../../../../shared/i18n/locale';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { workflowStageLabelKey } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import type { WorkflowStageCallScript } from '../../../../lib/admin-workflow-stage-call-scripts-client';
import { useUpdateWorkflowStageCallScript } from '../hooks/useUpdateWorkflowStageCallScript';

interface WorkflowStageCallScriptRowProps {
  script: WorkflowStageCallScript;
}

/**
 * One canonical workflow stage's automatic call (its RoboCall voice), view
 * mode by default with an Edit action -- mirrors CandidateProfileCard.tsx's
 * "toggle isEditing, render a controlled form" pattern. Unlike that card,
 * saving here can have a real external side effect: turning `active` on (or
 * changing the voice of an already-active call) means every future candidate
 * entering this workflow stage automatically receives a billed voice call
 * -- EditMode gates exactly those two cases behind a confirmation step (see
 * `needsConfirmation` there); a save that only deactivates a call, or edits
 * the voice while staying inactive, goes straight through.
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
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand"><Mic className="h-4 w-4" aria-hidden="true" /></span>
          <h3 className="text-sm font-semibold text-text-primary">{stageLabel(script.workflowStageCode, t)}</h3>
          <Badge tone={script.active ? 'success' : 'neutral'}>
            {script.active ? t('adminWorkflowStageCallScriptActive') : t('adminWorkflowStageCallScriptInactive')}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('adminWorkflowStageCallScriptEditAction')}
        </Button>
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
        <p className="mb-1 text-xs font-medium text-text-tertiary">{t('adminWorkflowStageCallScriptVoiceIdLabel')}</p>
        {script.voiceId ? (
          <p dir="ltr" className="font-mono text-sm text-text-primary">{script.voiceId}</p>
        ) : (
          <p className="text-sm italic text-text-tertiary">{t('adminWorkflowStageCallScriptVoiceIdNone')}</p>
        )}
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
  const [voiceId, setVoiceId] = useState(script.voiceId ?? '');
  const [active, setActive] = useState(script.active);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mutation = useUpdateWorkflowStageCallScript();

  const save = () => {
    mutation.mutate(
      { workflowStageCode: script.workflowStageCode, input: { voiceId, active } },
      { onSuccess: onDone }
    );
  };

  // A save has a real external side effect -- future candidates entering
  // this workflow stage will automatically receive a billed voice call --
  // exactly when the RESULTING state is active and either it wasn't active
  // before (activation) or the voice an active call plays is changing.
  // Deactivating, or editing the voice while staying inactive, has no such
  // effect and saves immediately.
  const activating = active && !script.active;
  const changingActiveVoice = active && script.active && voiceId.trim() !== (script.voiceId ?? '');
  const needsConfirmation = activating || changingActiveVoice;

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
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{stageLabel(script.workflowStageCode, t)}</h3>
      <div className="space-y-3">
        <Input
          label={t('adminWorkflowStageCallScriptVoiceIdLabel')}
          helperText={t('adminWorkflowStageCallScriptVoiceIdHint')}
          value={voiceId}
          onChange={(event) => setVoiceId(event.target.value)}
          errorMessage={errorMessage}
          dir="ltr"
          maxLength={32}
          autoComplete="off"
        />
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

/** The stage's name; a code this build has no name for is shown as it is rather than blank. */
function stageLabel(code: string, t: (key: TranslationKey) => string): string {
  const key = workflowStageLabelKey(code);
  return key ? t(key) : code;
}
