import { StaffShell } from "../../../components/staff-shell";
import { RequireStaffAuth } from "../../../../features/staffAuth/RequireStaffAuth";
import { SubmissionDetail } from "../../../../features/admin/documentReviews/components/SubmissionDetail";

export default function DocumentReviewDetailPage({ params }) {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidate_documents">
        <SubmissionDetail submissionId={params.id} />
      </RequireStaffAuth>
    </StaffShell>
  );
}
