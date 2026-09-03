import { StaffShell } from "../../../../components/staff-shell";
import { RequireStaffAuth } from "../../../../../features/staffAuth/RequireStaffAuth";
import { CandidateImportHistoryList } from "../../../../../features/admin/candidate-import/components/CandidateImportHistoryList";

// routes.ts ranks this static "history" segment above the dynamic
// [id]/page.jsx sibling for the exact path
// /admin/candidates/import/history -- same precedent as
// /admin/candidates/new vs. /admin/candidates/[id].
export default function CandidateImportHistoryPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidates">
        <CandidateImportHistoryList />
      </RequireStaffAuth>
    </StaffShell>
  );
}
