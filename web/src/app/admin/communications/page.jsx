import { StaffShell } from "../../components/staff-shell";
import { CommunicationList } from "../../../features/admin/communications/components/CommunicationList";

// GET /api/v1/admin/communications is open to every active staff member (a
// read-only report). StaffShell already wraps every staff screen in
// RequireStaffAuth (authentication only), so no extra guard is needed here.
export default function AdminCommunicationsPage() {
  return (
    <StaffShell>
      <CommunicationList />
    </StaffShell>
  );
}
