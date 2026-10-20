import { StaffShell } from "../../components/staff-shell";
import { BulkCallPage } from "../../../features/admin/bulkCalls/components/BulkCallPage";

// Needs trigger_ai_calls (and manage_ai_call_scripts to change call types).
// StaffShell already wraps every staff screen in RequireStaffAuth with no
// permission (authentication only); a staff member without them reaches this
// page and sees each section's own FORBIDDEN state -- same pattern as
// AdminAiCallScriptsPage.
export default function AdminBulkCallsPage() {
  return (
    <StaffShell>
      <BulkCallPage />
    </StaffShell>
  );
}
