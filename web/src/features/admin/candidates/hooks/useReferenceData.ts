import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { adminCandidateClient } from '../../../../lib/admin-candidates-client';
import type { AdminCandidateError, ReferenceDataItem } from '../../../../lib/admin-candidates-client';
import { adminCandidateQueries } from '../../../../../../shared/queryKeys/adminCandidateQueries';

/** Populates the country/project/craft selects on the create/edit forms -- real reference data only, never a hardcoded option list. */
export function useCountries() {
  const { language } = useLanguage();
  return useQuery<ReferenceDataItem[], AdminCandidateError>({
    queryKey: adminCandidateQueries.countries(language),
    queryFn: () => adminCandidateClient.getCountries(),
  });
}

export function useProjects() {
  const { language } = useLanguage();
  return useQuery<ReferenceDataItem[], AdminCandidateError>({
    queryKey: adminCandidateQueries.projects(language),
    queryFn: () => adminCandidateClient.getProjects(),
  });
}

export function useCrafts() {
  const { language } = useLanguage();
  return useQuery<ReferenceDataItem[], AdminCandidateError>({
    queryKey: adminCandidateQueries.crafts(language),
    queryFn: () => adminCandidateClient.getCrafts(),
  });
}
