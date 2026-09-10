import { StaffShell } from "../../components/staff-shell";
import { AuditEventList } from "../../../features/admin/auditEvents/components/AuditEventList";

// GET /api/v1/admin/audit_events requires view_audit_events. StaffShell
// already wraps every staff screen in RequireStaffAuth with no permission
// (authentication only); a staff member lacking view_audit_events reaches
// this page and sees AuditEventList's own FORBIDDEN state instead -- same
// pattern as AdminFinancePaymentsPage.
export default function AdminAuditLogPage() {
  return (
    <StaffShell>
      <AuditEventList />
    </StaffShell>
  );
}
