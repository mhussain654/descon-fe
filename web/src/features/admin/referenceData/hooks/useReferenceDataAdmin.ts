import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminReferenceDataClient } from '../../../../lib/admin-reference-data-client';
import type {
  ChecklistData,
  ChecklistRequirement,
  ChecklistRequirementCreateInput,
  ChecklistRequirementInput,
  LookupInput,
  LookupKind,
  LookupRecord,
  MobilizationProcessRecord,
  ReferenceDataError,
  RolePermissionsMatrix,
  WorkflowStageRecord,
} from '../../../../lib/admin-reference-data-client';
import { adminReferenceDataQueries } from '../../../../../../shared/queryKeys/adminReferenceDataQueries';

/**
 * After any change, refetch every reference data query, including the lookup
 * lists candidate forms use (countries, projects, crafts) and stage names.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useLookups(kind: LookupKind) {
  const { language } = useLanguage();
  return useQuery<LookupRecord[], ReferenceDataError>({
    queryKey: adminReferenceDataQueries.lookups(kind, language),
    queryFn: () => adminReferenceDataClient.listLookups(kind),
  });
}

export type LookupMutation =
  | { action: 'create'; input: LookupInput }
  | { action: 'update'; code: string; input: LookupInput; expectedUpdatedAt: string }
  | { action: 'retire' | 'restore' | 'delete'; code: string };

export function useLookupMutation(kind: LookupKind) {
  const invalidate = useInvalidateAll();
  return useMutation<unknown, ReferenceDataError, LookupMutation>({
    mutationFn: (change) => {
      switch (change.action) {
        case 'create':
          return adminReferenceDataClient.createLookup(kind, change.input);
        case 'update':
          return adminReferenceDataClient.updateLookup(kind, change.code, change.input, change.expectedUpdatedAt);
        case 'retire':
          return adminReferenceDataClient.retireLookup(kind, change.code);
        case 'restore':
          return adminReferenceDataClient.restoreLookup(kind, change.code);
        case 'delete':
          return adminReferenceDataClient.deleteLookup(kind, change.code);
      }
    },
    onSuccess: invalidate,
  });
}

export function useRolePermissions() {
  const { language } = useLanguage();
  return useQuery<RolePermissionsMatrix, ReferenceDataError>({
    queryKey: adminReferenceDataQueries.rolePermissions(language),
    queryFn: () => adminReferenceDataClient.getRolePermissions(),
  });
}

export function useSetRolePermissions() {
  const invalidate = useInvalidateAll();
  return useMutation<RolePermissionsMatrix, ReferenceDataError, { roleCode: string; permissionCodes: string[] }>({
    mutationFn: ({ roleCode, permissionCodes }) => adminReferenceDataClient.setRolePermissions(roleCode, permissionCodes),
    onSuccess: invalidate,
  });
}

export function useChecklist() {
  const { language } = useLanguage();
  return useQuery<ChecklistData, ReferenceDataError>({
    queryKey: adminReferenceDataQueries.checklist(language),
    queryFn: () => adminReferenceDataClient.getChecklist(),
  });
}

export type RequirementMutation =
  | { action: 'create'; input: ChecklistRequirementCreateInput }
  | { action: 'update'; id: string; input: ChecklistRequirementInput; expectedUpdatedAt: string };

export function useRequirementMutation() {
  const invalidate = useInvalidateAll();
  return useMutation<ChecklistRequirement, ReferenceDataError, RequirementMutation>({
    mutationFn: (change) =>
      change.action === 'create'
        ? adminReferenceDataClient.createRequirement(change.input)
        : adminReferenceDataClient.updateRequirement(change.id, change.input, change.expectedUpdatedAt),
    onSuccess: invalidate,
  });
}

export function useWorkflowStagesAdmin() {
  const { language } = useLanguage();
  return useQuery<WorkflowStageRecord[], ReferenceDataError>({
    queryKey: adminReferenceDataQueries.workflowStages(language),
    queryFn: () => adminReferenceDataClient.listWorkflowStages(),
  });
}

export function useUpdateWorkflowStage() {
  const invalidate = useInvalidateAll();
  return useMutation<WorkflowStageRecord, ReferenceDataError, { code: string; nameEn: string; nameUr: string }>({
    mutationFn: ({ code, nameEn, nameUr }) => adminReferenceDataClient.updateWorkflowStage(code, { nameEn, nameUr }),
    onSuccess: invalidate,
  });
}

export function useMobilizationProcesses() {
  const { language } = useLanguage();
  return useQuery<MobilizationProcessRecord[], ReferenceDataError>({
    queryKey: adminReferenceDataQueries.mobilizationProcesses(language),
    queryFn: () => adminReferenceDataClient.listMobilizationProcesses(),
  });
}
