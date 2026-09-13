import { StaffShell } from "../../components/staff-shell";
import { CommunicationList } from "../../../features/admin/communications/components/CommunicationList";

// GET /api/v1/admin/communications requires view_communications or
// manage_communications. StaffShell already wraps every staff screen in
// RequireStaffAuth with no permission (authentication only); a staff member
// lacking both permissions reaches this page and sees CommunicationList's
// own FORBIDDEN state instead -- same pattern as AdminAuditLogPage.
export default function AdminCommunicationsPage() {
  return (
    <StaffShell>
      <CommunicationList />
    </StaffShell>
  );
}
