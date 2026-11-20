import { StaffShell } from "../../components/staff-shell";
import { MobilizationWorkspace } from "../../../features/admin/mobilizations/components/MobilizationWorkspace";

// Same access as the candidate list (view_candidates or manage_candidates on
// the backend), so like that page it shows the workspace's own FORBIDDEN
// state rather than a single-permission route guard.
export default function AdminMobilizationPage() {
  return (
    <StaffShell>
      <MobilizationWorkspace />
    </StaffShell>
  );
}
