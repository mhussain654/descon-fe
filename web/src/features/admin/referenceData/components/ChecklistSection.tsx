import { useEffect, useMemo, useState } from 'react';
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
  Select,
  Textarea,
  ValidationMessage,
  toast,
  type BadgeTone,
  type DataTableColumn,
} from '../../../../design-system';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { ChecklistData, ChecklistRequirement, RequirementLevel } from '../../../../lib/admin-reference-data-client';
import { useCountries } from '../../candidates/hooks/useReferenceData';
import { useChecklist, useRequirementMutation } from '../hooks/useReferenceDataAdmin';
import { ReferenceDataQueryState, referenceDataErrorMessage } from './ReferenceDataQueryState';

const COMMON = '__common__';

const LEVELS: RequirementLevel[] = ['required', 'optional', 'not_applicable'];
const LEVEL_KEYS: Record<RequirementLevel, TranslationKey> = {
  required: 'adminRefDataLevelRequired',
  optional: 'adminRefDataLevelOptional',
  not_applicable: 'adminRefDataLevelNotApplicable',
};
const LEVEL_TONES: Record<RequirementLevel, BadgeTone> = { required: 'brand', optional: 'info', not_applicable: 'neutral' };

const CONTENT_TYPE_LABELS: Record<string, string> = { 'application/pdf': 'PDF', 'image/jpeg': 'JPEG', 'image/png': 'PNG' };

type Editing = { mode: 'create' } | { mode: 'edit'; requirement: ChecklistRequirement } | null;

/** Document checklists: the common list and each country's, with instructions, file rules and on/off. */
export function ChecklistSection() {
  const { t } = useLanguage();
  const query = useChecklist();
  const countries = useCountries();
  const [scope, setScope] = useState(COMMON);
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-text-primary">{t('adminRefDataTabChecklists')}</h2>
          <p className="text-xs text-text-secondary">{t('adminRefDataChecklistHelp')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-56">
            <Select
              label={t('adminRefDataChecklistScope')}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              options={[
                { value: COMMON, label: t('adminRefDataChecklistCommon') },
                ...(countries.data ?? []).map((country) => ({ value: country.code, label: country.name })),
              ]}
            />
          </div>
          <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
            {t('adminRefDataAddDocument')}
          </Button>
        </div>
      </div>
      <ReferenceDataQueryState query={query}>
        {(data) => (
          <>
            <RequirementTable data={data} scope={scope} onEdit={(requirement) => setEditing({ mode: 'edit', requirement })} />
            <RequirementDialog data={data} scope={scope} editing={editing} onClose={() => setEditing(null)} />
          </>
        )}
      </ReferenceDataQueryState>
    </Card>
  );
}

function scopeDetail(requirement: ChecklistRequirement, t: (key: TranslationKey) => string): string {
  return [requirement.project?.name, requirement.craft?.name, requirement.driverOnly ? t('adminRefDataDriverOnly') : null]
    .filter(Boolean)
    .join(' · ');
}

function RequirementTable({ data, scope, onEdit }: { data: ChecklistData; scope: string; onEdit: (requirement: ChecklistRequirement) => void }) {
  const { t } = useLanguage();
  const rows = useMemo(
    () => data.requirements.filter((requirement) => (scope === COMMON ? requirement.country === null : requirement.country?.code === scope)),
    [data, scope]
  );

  const columns: DataTableColumn<ChecklistRequirement>[] = [
    {
      key: 'document',
      header: t('adminRefDataDocument'),
      render: (row) => (
        <div>
          <span className="block text-text-primary">{row.documentType.name}</span>
          {scopeDetail(row, t) ? <span className="block text-xs text-text-secondary">{scopeDetail(row, t)}</span> : null}
        </div>
      ),
    },
    { key: 'level', header: t('adminRefDataLevel'), render: (row) => <Badge tone={LEVEL_TONES[row.requirementLevel]}>{t(LEVEL_KEYS[row.requirementLevel])}</Badge> },
    { key: 'files', header: t('adminRefDataMaxFiles'), render: (row) => row.maximumFiles },
    { key: 'types', header: t('adminRefDataFileTypes'), render: (row) => row.acceptedContentTypes.map((type) => CONTENT_TYPE_LABELS[type] ?? type).join(', ') },
    {
      key: 'status',
      header: t('adminRefDataStatus'),
      render: (row) => <Badge tone={row.active ? 'success' : 'neutral'}>{t(row.active ? 'adminRefDataActive' : 'adminRefDataOff')}</Badge>,
    },
    {
      key: 'actions',
      header: t('adminRefDataActions'),
      render: (row) => (
        <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
          {t('adminRefDataEdit')}
        </Button>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} getRowId={(row) => row.id} emptyState={<EmptyState title={t('adminRefDataChecklistEmpty')} />} />;
}

function RequirementDialog({ data, scope, editing, onClose }: { data: ChecklistData; scope: string; editing: Editing; onClose: () => void }) {
  const { t } = useLanguage();
  const mutation = useRequirementMutation();
  const [documentTypeCode, setDocumentTypeCode] = useState('');
  const [level, setLevel] = useState<RequirementLevel>('required');
  const [active, setActive] = useState(true);
  const [maximumFiles, setMaximumFiles] = useState('1');
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [instructionsEn, setInstructionsEn] = useState('');
  const [instructionsUr, setInstructionsUr] = useState('');
  const [missingType, setMissingType] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const requirement = editing.mode === 'edit' ? editing.requirement : null;
    setDocumentTypeCode(requirement?.documentType.code ?? '');
    setLevel(requirement?.requirementLevel ?? 'required');
    setActive(requirement?.active ?? true);
    setMaximumFiles(String(requirement?.maximumFiles ?? 1));
    setContentTypes(requirement?.acceptedContentTypes ?? data.contentTypes);
    setInstructionsEn(requirement?.instructionsEn ?? '');
    setInstructionsUr(requirement?.instructionsUr ?? '');
    setMissingType(false);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset the form each time it opens
  }, [editing]);

  const scopeTaken = new Set(
    data.requirements
      .filter((requirement) => (scope === COMMON ? requirement.country === null : requirement.country?.code === scope) && !requirement.project && !requirement.craft)
      .map((requirement) => requirement.documentType.code)
  );

  const fieldError = (field: string) => (mutation.error?.field?.endsWith(field) ? mutation.error.message : undefined);
  const generalError = mutation.isError && !mutation.error?.field ? referenceDataErrorMessage(mutation.error, t('adminRefDataSaveError')) : undefined;

  const toggleType = (type: string) =>
    setContentTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));

  const submit = () => {
    const input = {
      requirementLevel: level,
      active,
      maximumFiles: Number.parseInt(maximumFiles, 10) || 1,
      acceptedContentTypes: contentTypes,
      instructionsEn,
      instructionsUr,
    };
    const onSuccess = () => {
      toast.success(t('adminRefDataSaved'));
      onClose();
    };
    if (editing?.mode === 'edit') {
      mutation.mutate({ action: 'update', id: editing.requirement.id, input, expectedUpdatedAt: editing.requirement.updatedAt }, { onSuccess });
      return;
    }
    if (!documentTypeCode) {
      setMissingType(true);
      return;
    }
    mutation.mutate({ action: 'create', input: { ...input, documentTypeCode, countryCode: scope === COMMON ? null : scope } }, { onSuccess });
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        title={editing?.mode === 'edit' ? editing.requirement.documentType.name : t('adminRefDataAddDocument')}
        description={t('adminRefDataRequirementHelp')}
        closeLabel={t('adminRefDataCancel')}
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pe-1">
          {editing?.mode === 'create' ? (
            <Select
              label={t('adminRefDataDocument')}
              value={documentTypeCode}
              onChange={(event) => setDocumentTypeCode(event.target.value)}
              options={[
                { value: '', label: t('adminRefDataPickDocument') },
                ...data.documentTypes.filter((type) => !scopeTaken.has(type.code)).map((type) => ({ value: type.code, label: type.name })),
              ]}
              errorMessage={missingType ? t('adminRefDataRequired') : fieldError('document_type_code')}
            />
          ) : null}
          <Select
            label={t('adminRefDataLevel')}
            value={level}
            onChange={(event) => setLevel(event.target.value as RequirementLevel)}
            options={LEVELS.map((value) => ({ value, label: t(LEVEL_KEYS[value]) }))}
            errorMessage={fieldError('requirement_level')}
          />
          <Input
            label={t('adminRefDataMaxFiles')}
            type="number"
            min={1}
            max={20}
            value={maximumFiles}
            onChange={(event) => setMaximumFiles(event.target.value)}
            errorMessage={fieldError('maximum_files')}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-text-primary">{t('adminRefDataFileTypes')}</legend>
            <div className="flex flex-wrap gap-4">
              {data.contentTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" className="h-4 w-4 accent-brand" checked={contentTypes.includes(type)} onChange={() => toggleType(type)} />
                  {CONTENT_TYPE_LABELS[type] ?? type}
                </label>
              ))}
            </div>
            {fieldError('accepted_content_types') ? (
              <div className="mt-1">
                <ValidationMessage tone="error">{fieldError('accepted_content_types')}</ValidationMessage>
              </div>
            ) : null}
          </fieldset>
          <Textarea label={t('adminRefDataInstructionsEn')} value={instructionsEn} rows={3} maxLength={2000} onChange={(event) => setInstructionsEn(event.target.value)} />
          <Textarea label={t('adminRefDataInstructionsUr')} value={instructionsUr} rows={3} maxLength={2000} dir="rtl" onChange={(event) => setInstructionsUr(event.target.value)} />
          <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-brand" />
            {t('adminRefDataRequirementActive')}
          </label>
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
