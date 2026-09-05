import { StaffShell } from "../../components/staff-shell";
import { AdminDashboard } from "../../../features/admin/dashboard/components/AdminDashboard";

// GET /api/v1/admin/dashboard requires view_admin_dashboard. StaffShell
// already wraps every staff screen in RequireStaffAuth with no permission
// (authentication only); a staff member lacking view_admin_dashboard
// reaches this page and sees AdminDashboard's own FORBIDDEN state instead
// -- same pattern as AdminAuditLogPage.
export default function AdminDashboardPage() {
  return (
    <StaffShell>
      <AdminDashboard />
    </StaffShell>
  );
}
