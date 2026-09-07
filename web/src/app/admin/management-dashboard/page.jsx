import { StaffShell } from "../../components/staff-shell";
import { ManagementDashboard } from "../../../features/admin/managementDashboard/components/ManagementDashboard";

// GET /api/v1/admin/management_dashboard requires view_management_dashboard.
// StaffShell already wraps every staff screen in RequireStaffAuth with no
// permission (authentication only); a staff member lacking
// view_management_dashboard reaches this page and sees
// ManagementDashboard's own FORBIDDEN state instead -- same pattern as
// AdminAuditLogPage.
export default function AdminManagementDashboardPage() {
  return (
    <StaffShell>
      <ManagementDashboard />
    </StaffShell>
  );
}
