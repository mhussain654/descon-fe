import { StaffShell } from "../../components/staff-shell";
import { TrainingSettingPage as TrainingSettingContent } from "../../../features/admin/trainingSetting/components/TrainingSettingPage";

// GET/PATCH /api/v1/admin/training_setting require manage_training_settings
// (admin-only by default). StaffShell already wraps every staff screen in
// RequireStaffAuth with no permission (authentication only); a staff member
// lacking manage_training_settings reaches this page and sees
// TrainingSettingForm's own FORBIDDEN state instead -- same pattern as
// AdminAiCallSettingsPage.
export default function AdminTrainingSettingsPage() {
  return (
    <StaffShell>
      <TrainingSettingContent />
    </StaffShell>
  );
}
