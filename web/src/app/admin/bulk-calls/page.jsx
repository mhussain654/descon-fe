import { StaffShell } from "../../components/staff-shell";
import { BulkCallPage } from "../../../features/admin/bulkCalls/components/BulkCallPage";

// Needs trigger_ai_calls; the call types themselves are set up in Settings.
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
