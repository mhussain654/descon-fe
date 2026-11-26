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
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { LookupKind, LookupRecord } from '../../../../lib/admin-reference-data-client';
import { useLookupMutation, useLookups } from '../hooks/useReferenceDataAdmin';
import { ReferenceDataQueryState, referenceDataErrorMessage } from './ReferenceDataQueryState';

const TITLE_KEYS: Record<LookupKind, TranslationKey> = {
  countries: 'adminRefDataTabCountries',
  projects: 'adminRefDataTabProjects',
  crafts: 'adminRefDataTabCrafts',
};

type Editing = { mode: 'create' } | { mode: 'edit'; record: LookupRecord } | null;

/** Countries, projects or crafts: add, rename, retire/restore, and delete one nothing uses yet. */
export function LookupSection({ kind }: { kind: LookupKind }) {
  const { t } = useLanguage();
  const query = useLookups(kind);
  const mutation = useLookupMutation(kind);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<LookupRecord | null>(null);

  const change = (record: LookupRecord, action: 'retire' | 'restore') =>
    mutation.mutate(
      { action, code: record.code },
      {
        onSuccess: () => toast.success(t(action === 'retire' ? 'adminRefDataRetired' : 'adminRefDataRestored')),
        onError: (error) => toast.error(referenceDataErrorMessage(error, t('adminRefDataSaveError')) ?? t('adminRefDataSaveError')),
      }
    );

  const columns: DataTableColumn<LookupRecord>[] = [
    { key: 'code', header: t('adminRefDataCode'), render: (row) => <span className="font-mono text-sm">{row.code}</span> },
    { key: 'nameEn', header: t('adminRefDataNameEn'), render: (row) => row.nameEn },
    { key: 'nameUr', header: t('adminRefDataNameUr'), render: (row) => <span dir="rtl">{row.nameUr}</span> },
    ...(kind === 'crafts'
      ? [{ key: 'driver', header: t('adminRefDataDriver'), render: (row: LookupRecord) => (row.isDriver ? t('adminRefDataYes') : t('adminRefDataNo')) }]
      : []),
    {
      key: 'status',
      header: t('adminRefDataStatus'),
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{t(row.active ? 'adminRefDataActive' : 'adminRefDataRetiredStatus')}</Badge>,
    },
    {
      key: 'actions',
      header: t('adminRefDataActions'),
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing({ mode: 'edit', record: row })}>
            {t('adminRefDataEdit')}
          </Button>
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => change(row, row.active ? 'retire' : 'restore')}>
            {t(row.active ? 'adminRefDataRetire' : 'adminRefDataRestore')}
          </Button>
          <Button size="sm" variant="text" onClick={() => setDeleting(row)}>
            {t('adminRefDataDelete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">{t(TITLE_KEYS[kind])}</h2>
          <p className="text-xs text-text-secondary">{t('adminRefDataLookupHelp')}</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
          {t('adminRefDataAdd')}
        </Button>
      </div>
      <ReferenceDataQueryState query={query}>
        {(rows) => (
          <DataTable columns={columns} rows={rows} getRowId={(row) => row.code} emptyState={<EmptyState title={t('adminRefDataEmpty')} />} />
        )}
      </ReferenceDataQueryState>
      <LookupDialog kind={kind} editing={editing} onClose={() => setEditing(null)} />
      <DeleteLookupDialog kind={kind} record={deleting} onClose={() => setDeleting(null)} />
    </Card>
  );
}

function LookupDialog({ kind, editing, onClose }: { kind: LookupKind; editing: Editing; onClose: () => void }) {
  const { t } = useLanguage();
  const mutation = useLookupMutation(kind);
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameUr, setNameUr] = useState('');
  const [isDriver, setIsDriver] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const record = editing.mode === 'edit' ? editing.record : null;
    setCode(record?.code ?? '');
    setNameEn(record?.nameEn ?? '');
    setNameUr(record?.nameUr ?? '');
    setIsDriver(record?.isDriver ?? false);
    setMissing(false);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the form each time it opens
  }, [editing]);

  const fieldError = (field: string) => (mutation.error?.field?.endsWith(field) ? mutation.error.message : undefined);
  const generalError = mutation.isError && !mutation.error?.field ? referenceDataErrorMessage(mutation.error, t('adminRefDataSaveError')) : undefined;

  const submit = () => {
    const isCreate = editing?.mode === 'create';
    if (!nameEn.trim() || !nameUr.trim() || (isCreate && !code.trim())) {
      setMissing(true);
      return;
    }
    const input = { nameEn, nameUr, ...(kind === 'crafts' ? { isDriver } : {}) };
    const onSuccess = () => {
      toast.success(t('adminRefDataSaved'));
      onClose();
    };
    if (editing?.mode === 'edit') {
      mutation.mutate({ action: 'update', code: editing.record.code, input, expectedUpdatedAt: editing.record.updatedAt }, { onSuccess });
    } else {
      mutation.mutate({ action: 'create', input: { ...input, code: code.trim().toLowerCase() } }, { onSuccess });
    }
  };

  const required = (value: string) => (missing && !value.trim() ? t('adminRefDataRequired') : undefined);

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        title={t(editing?.mode === 'edit' ? 'adminRefDataEditTitle' : 'adminRefDataAddTitle')}
        description={t('adminRefDataDialogHelp')}
        closeLabel={t('adminRefDataCancel')}
      >
        <div className="space-y-4">
          <Input
            label={t('adminRefDataCode')}
            value={code}
            maxLength={50}
            disabled={editing?.mode === 'edit'}
            helperText={t('adminRefDataCodeHelp')}
            onChange={(event) => setCode(event.target.value)}
            errorMessage={required(code) ?? fieldError('code')}
          />
          <Input label={t('adminRefDataNameEn')} value={nameEn} maxLength={120} onChange={(event) => setNameEn(event.target.value)} errorMessage={required(nameEn) ?? fieldError('name_en')} />
          <Input label={t('adminRefDataNameUr')} value={nameUr} maxLength={120} dir="rtl" onChange={(event) => setNameUr(event.target.value)} errorMessage={required(nameUr) ?? fieldError('name_ur')} />
          {kind === 'crafts' ? (
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <input type="checkbox" checked={isDriver} onChange={(event) => setIsDriver(event.target.checked)} className="h-4 w-4 accent-brand" />
              {t('adminRefDataDriverLabel')}
            </label>
          ) : null}
          {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('adminRefDataCancel')}
          </Button>
          <Button type="button" onClick={submit} loading={mutation.isPending} disabled={mutation.isPending}>
            {t('adminRefDataSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLookupDialog({ kind, record, onClose }: { kind: LookupKind; record: LookupRecord | null; onClose: () => void }) {
  const { t } = useLanguage();
  const mutation = useLookupMutation(kind);

  useEffect(() => {
    if (record) mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear the last error each time it opens
  }, [record]);

  const confirm = () => {
    if (!record) return;
    mutation.mutate(
      { action: 'delete', code: record.code },
      {
        onSuccess: () => {
          toast.success(t('adminRefDataDeleted'));
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={record !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent title={t('adminRefDataDeleteTitle')} description={t('adminRefDataDeleteHelp')} closeLabel={t('adminRefDataCancel')}>
        <p className="text-sm text-text-primary">
          <span className="font-mono">{record?.code}</span> — {record?.nameEn}
        </p>
        {mutation.isError ? (
          <div className="mt-3">
            <ValidationMessage tone="error">{referenceDataErrorMessage(mutation.error, t('adminRefDataSaveError'))}</ValidationMessage>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('adminRefDataCancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} loading={mutation.isPending} disabled={mutation.isPending}>
            {t('adminRefDataDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
