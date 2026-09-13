import { StaffShell } from "../../components/staff-shell";
import { StaffProfile } from "../../../features/staffAuth/StaffProfile";

// No permission gate beyond authentication -- every signed-in staff member
// can see their own account summary, same as StaffShell's account-menu
// identity block one level up.
export default function AdminProfilePage() {
  return (
    <StaffShell>
      <StaffProfile />
    </StaffShell>
  );
}
