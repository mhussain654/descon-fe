import { StaffShell } from "../../components/staff-shell";
import { RequireStaffAuth } from "../../../features/staffAuth/RequireStaffAuth";
import { DocumentReviewQueue } from "../../../features/admin/documentReviews/components/DocumentReviewQueue";

export default function DocumentReviewsPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidate_documents">
        <DocumentReviewQueue />
      </RequireStaffAuth>
    </StaffShell>
  );
}
