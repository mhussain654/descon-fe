import { StaffShell } from "../../components/staff-shell";
import { AiCallOperationalSettingsPage as AiCallOperationalSettingsContent } from "../../../features/admin/aiCallOperationalSettings/components/AiCallOperationalSettingsPage";

// GET/PATCH /api/v1/admin/ai_call_operational_settings require
// manage_ai_call_settings (admin-only by default). StaffShell already
// wraps every staff screen in RequireStaffAuth with no permission
// (authentication only); a staff member lacking manage_ai_call_settings
// reaches this page and sees AiCallOperationalSettingsForm's own FORBIDDEN
// state instead -- same pattern as AdminAuditLogPage.
export default function AdminAiCallSettingsPage() {
  return (
    <StaffShell>
      <AiCallOperationalSettingsContent />
    </StaffShell>
  );
}
