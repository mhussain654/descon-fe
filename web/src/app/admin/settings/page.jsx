import { StaffShell } from "../../components/staff-shell";
import { AppSettingsPage as AppSettingsContent } from "../../../features/admin/appSettings/components/AppSettingsPage";

// One Settings page with a tab per area (feature switches, fee, support
// number, call limits). Each tab shows only for staff holding its own
// permission, and each tab's API enforces the same; a staff member with none
// sees a forbidden state.
export default function AdminSettingsPage() {
  return (
    <StaffShell>
      <AppSettingsContent />
    </StaffShell>
  );
}
