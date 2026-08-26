import { StaffShell } from "../../../components/staff-shell";
import { RequireStaffAuth } from "../../../../features/staffAuth/RequireStaffAuth";
import { CandidateImportForm } from "../../../../features/admin/candidate-import/components/CandidateImportForm";

export default function CandidateImportPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidates">
        <CandidateImportForm />
      </RequireStaffAuth>
    </StaffShell>
  );
}
