import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../../contexts/StaffAuthContext";
import { adminFeesClient } from "../../../../lib/admin-fees-client";
import { adminFeeQueries } from "../../../../../../shared/queryKeys/adminFeeQueries";
import type {
  AdminFee,
  AdminFeeError,
} from "../../../../../../shared/adminFees/types";

/** Shared by the fee editor and Overview, so saving a fee updates both. */
export function useAdminFee(candidateId?: string) {
  const { language } = useLanguage();
  const { hasPermission } = useStaffAuth();
  return useQuery<AdminFee, AdminFeeError>({
    queryKey: adminFeeQueries.detail(candidateId, language),
    queryFn: () => adminFeesClient.getFee(candidateId),
    enabled: hasPermission("view_payments") || hasPermission("manage_payments"),
    retry: false,
  });
}
