import { StaffShell } from "../../components/staff-shell";
import { SupportSettingPage as SupportSettingContent } from "../../../features/admin/supportSetting/components/SupportSettingPage";

// GET/PATCH /api/v1/admin/support_setting require manage_support_settings
// (admin-only by default). StaffShell already wraps every staff screen in
// RequireStaffAuth with no permission (authentication only); a staff member
// lacking manage_support_settings reaches this page and sees
// SupportSettingForm's own FORBIDDEN state instead -- same pattern as
// AdminAiCallSettingsPage.
export default function AdminSupportSettingsPage() {
  return (
    <StaffShell>
      <SupportSettingContent />
    </StaffShell>
  );
}
