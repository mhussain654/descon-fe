import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Card, FilterChip, ValidationMessage, toast } from '../../../../design-system';
import type { RolePermissionsMatrix } from '../../../../lib/admin-reference-data-client';
import { useRolePermissions, useSetRolePermissions } from '../hooks/useReferenceDataAdmin';
import { ReferenceDataQueryState, referenceDataErrorMessage } from './ReferenceDataQueryState';

/** Which permissions each staff role has. The developer role always has all of them. */
export function RolePermissionsSection() {
  const { t } = useLanguage();
  const query = useRolePermissions();
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="font-semibold text-text-primary">{t('adminRefDataTabRoles')}</h2>
      <p className="mb-4 text-xs text-text-secondary">{t('adminRefDataRolesHelp')}</p>
      <ReferenceDataQueryState query={query}>{(matrix) => <RoleEditor matrix={matrix} />}</ReferenceDataQueryState>
    </Card>
  );
}

function RoleEditor({ matrix }: { matrix: RolePermissionsMatrix }) {
  const { t } = useLanguage();
  const save = useSetRolePermissions();
  const firstEditable = matrix.roles.find((role) => !role.locked) ?? matrix.roles[0];
  const [roleCode, setRoleCode] = useState(firstEditable?.code ?? '');
  const role = matrix.roles.find((candidate) => candidate.code === roleCode);
  const saved = useMemo(() => new Set(matrix.grants[roleCode] ?? []), [matrix, roleCode]);
  const [selected, setSelected] = useState<Set<string>>(saved);

  useEffect(() => {
    setSelected(new Set(saved));
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when the role or saved grants change
  }, [saved]);

  const dirty = selected.size !== saved.size || [...selected].some((code) => !saved.has(code));

  const toggle = (code: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const submit = () =>
    save.mutate(
      { roleCode, permissionCodes: [...selected] },
      { onSuccess: () => toast.success(t('adminRefDataSaved')) }
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {matrix.roles.map((candidate) => (
          <FilterChip key={candidate.code} selected={candidate.code === roleCode} onClick={() => setRoleCode(candidate.code)}>
            {candidate.name}
          </FilterChip>
        ))}
      </div>
      {role?.locked ? (
        <p className="mb-3 rounded-lg bg-surface-sunken p-3 text-sm text-text-secondary">{t('adminRefDataRoleLocked')}</p>
      ) : null}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {matrix.permissions.map((permission) => {
          const blocked = !!role?.locked || (permission.developerOnly && roleCode !== 'developer');
          return (
            <li key={permission.code}>
              <label className={`flex items-start gap-2 rounded-lg border border-border p-2 text-sm ${blocked ? 'opacity-60' : ''}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand"
                  checked={role?.locked ? true : selected.has(permission.code)}
                  disabled={blocked || save.isPending}
                  onChange={() => toggle(permission.code)}
                />
                <span className="min-w-0">
                  <span className="block text-text-primary">{permission.name}</span>
                  <span className="block font-mono text-xs text-text-secondary">{permission.code}</span>
                  {permission.developerOnly ? (
                    <span className="mt-1 inline-block">
                      <Badge tone="warning">{t('adminRefDataDeveloperOnly')}</Badge>
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {save.isError ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{referenceDataErrorMessage(save.error, t('adminRefDataSaveError'))}</ValidationMessage>
        </div>
      ) : null}
      {role && !role.locked ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="secondary" disabled={!dirty || save.isPending} onClick={() => setSelected(new Set(saved))}>
            {t('adminRefDataUndo')}
          </Button>
          <Button size="sm" onClick={submit} disabled={!dirty || save.isPending} loading={save.isPending}>
            {t('adminRefDataSave')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
