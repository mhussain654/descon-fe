import { StaffShell } from "../../components/staff-shell";
import { MpsDashboard } from "../../../features/admin/mpsDashboard/components/MpsDashboard";

// GET /api/v1/admin/mps_dashboard requires view_mps_dashboard. StaffShell
// already wraps every staff screen in RequireStaffAuth with no permission
// (authentication only); a staff member lacking view_mps_dashboard reaches
// this page and sees MpsDashboard's own FORBIDDEN state instead -- same
// pattern as AdminAuditLogPage.
export default function AdminMpsDashboardPage() {
  return (
    <StaffShell>
      <MpsDashboard />
    </StaffShell>
  );
}
