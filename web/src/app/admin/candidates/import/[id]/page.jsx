import { StaffShell } from "../../../../components/staff-shell";
import { RequireStaffAuth } from "../../../../../features/staffAuth/RequireStaffAuth";
import { CandidateImportDetail } from "../../../../../features/admin/candidate-import/components/CandidateImportDetail";

export default function CandidateImportDetailPage({ params }) {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidates">
        <CandidateImportDetail importId={params.id} />
      </RequireStaffAuth>
    </StaffShell>
  );
}
