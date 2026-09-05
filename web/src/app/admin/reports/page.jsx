import { StaffShell } from "../../components/staff-shell";
import { ReportsWorkspace } from "../../../features/admin/reports/components/ReportsWorkspace";

// GET /api/v1/admin/reports requires view_reports. StaffShell already wraps
// every staff screen in RequireStaffAuth with no permission (authentication
// only); a staff member lacking view_reports reaches this page and sees
// ReportsWorkspace's own FORBIDDEN state instead -- same pattern as
// AdminAuditLogPage.
export default function AdminReportsPage() {
  return (
    <StaffShell>
      <ReportsWorkspace />
    </StaffShell>
  );
}
