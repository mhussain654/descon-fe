import { useState, type FormEvent } from 'react';
import { Mic, Pencil, Plus } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, Input } from '../../../../design-system';
import type { RobocallVoice } from '../../../../lib/admin-bulk-calls-client';
import { BULK_CALL_ERROR_KEYS } from '../../../../../../shared/adminBulkCalls/errorMessages';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useRobocallVoices } from '../hooks/useRobocallVoices';
import { useSaveRobocallVoice } from '../hooks/useSaveRobocallVoice';
import { QueryStateView } from './QueryStateView';

/** The call types: named RoboCall voices an admin picks from for a bulk call. Reading needs `trigger_ai_calls`; adding, editing and switching one off need `manage_ai_call_scripts`. */
export function CallTypesCard() {
  const { t } = useLanguage();
  const { hasPermission } = useStaffAuth();
  const query = useRobocallVoices();
  const canManage = hasPermission('manage_ai_call_scripts');
  const [editing, setEditing] = useState<RobocallVoice | 'new' | null>(null);

  return (
    <Card className="mb-5 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <Mic className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminBulkCallTypesTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminBulkCallTypesDescription')}</p>
          </div>
        </div>
        {canManage && editing === null ? (
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('adminBulkCallTypeAddAction')}
          </Button>
        ) : null}
      </div>

      <QueryStateView query={query}>
        {editing === 'new' ? <VoiceForm key="new" onDone={() => setEditing(null)} /> : null}
        {(query.data ?? []).length === 0 && editing !== 'new' ? (
          <p className="text-sm text-text-secondary">{t('adminBulkCallTypesEmpty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {(query.data ?? []).map((voice) =>
              editing !== 'new' && editing?.id === voice.id ? (
                <li key={voice.id} className="py-3">
                  <VoiceForm voice={voice} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <VoiceRow key={voice.id} voice={voice} canManage={canManage} onEdit={() => setEditing(voice)} />
              )
            )}
          </ul>
        )}
      </QueryStateView>
    </Card>
  );
}

function VoiceRow({ voice, canManage, onEdit }: { voice: RobocallVoice; canManage: boolean; onEdit: () => void }) {
  const { t } = useLanguage();
  const save = useSaveRobocallVoice();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">{voice.nameEn}</span>
          {voice.nameUr ? <span dir="rtl" className="text-sm text-text-secondary">{voice.nameUr}</span> : null}
          <Badge tone={voice.active ? 'success' : 'neutral'}>{voice.active ? t('adminBulkCallTypeActive') : t('adminBulkCallTypeInactive')}</Badge>
        </div>
        <p dir="ltr" className="mt-0.5 font-mono text-xs text-text-tertiary">{voice.voiceId}</p>
      </div>
      {canManage ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('adminBulkCallTypeEditAction')}
          </Button>
          <Button variant="outline" size="sm" loading={save.isPending} onClick={() => save.mutate({ id: voice.id, input: { active: !voice.active } })}>
            {voice.active ? t('adminBulkCallTypeSwitchOff') : t('adminBulkCallTypeSwitchOn')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function VoiceForm({ voice, onDone }: { voice?: RobocallVoice; onDone: () => void }) {
  const { t } = useLanguage();
  const save = useSaveRobocallVoice();
  const [nameEn, setNameEn] = useState(voice?.nameEn ?? '');
  const [nameUr, setNameUr] = useState(voice?.nameUr ?? '');
  const [voiceId, setVoiceId] = useState(voice?.voiceId ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: voice?.id, input: { nameEn, nameUr, voiceId, active: voice?.active ?? true } }, { onSuccess: onDone });
  };

  const error = save.isError ? save.error : undefined;
  const errorMessage = error ? error.message || t((BULK_CALL_ERROR_KEYS[error.code] ?? 'somethingWentWrong') as TranslationKey) : undefined;

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl border border-border bg-surface-sunken p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label={t('adminBulkCallTypeNameLabel')} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
        <Input label={t('adminBulkCallTypeNameUrLabel')} value={nameUr} onChange={(event) => setNameUr(event.target.value)} dir="rtl" />
        <Input
          label={t('adminBulkCallTypeVoiceIdLabel')}
          value={voiceId}
          onChange={(event) => setVoiceId(event.target.value)}
          errorMessage={errorMessage}
          dir="ltr"
          maxLength={32}
          autoComplete="off"
          required
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={save.isPending}>
          {t('adminBulkCallCancelAction')}
        </Button>
        <Button type="submit" size="sm" loading={save.isPending}>
          {t('adminBulkCallTypeSaveAction')}
        </Button>
      </div>
    </form>
  );
}
