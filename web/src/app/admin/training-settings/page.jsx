import { StaffShell } from "../../components/staff-shell";
import { TrainingSettingPage as TrainingSettingContent } from "../../../features/admin/trainingSetting/components/TrainingSettingPage";

// Authenticated staff page; the API enforces manage_training_settings for every action.
export default function AdminTrainingSettingsPage() {
  return (
    <StaffShell>
      <TrainingSettingContent />
    </StaffShell>
  );
}
