import { StaffShell } from "../../components/staff-shell";
import { SystemBackupList } from "../../../features/admin/systemBackups/components/SystemBackupList";

// GET /api/v1/admin/system_database_backups requires manage_backups.
// StaffShell already wraps every staff screen in RequireStaffAuth with no
// permission (authentication only); a staff member lacking manage_backups
// reaches this page and sees SystemBackupList's own FORBIDDEN state instead
// -- same pattern as AdminAuditLogPage.
export default function AdminBackupsPage() {
  return (
    <StaffShell>
      <SystemBackupList />
    </StaffShell>
  );
}
