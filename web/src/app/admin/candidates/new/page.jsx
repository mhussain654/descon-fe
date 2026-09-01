import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { StaffShell } from "../../../components/staff-shell";
import { RequireStaffAuth } from "../../../../features/staffAuth/RequireStaffAuth";
import { CandidateCreateForm } from "../../../../features/admin/candidates/components/CandidateCreateForm";
import { useLanguage } from "../../../../contexts/LanguageContext";

// A literal sibling of [id]/page.jsx -- routes.ts ranks this static path
// above the dynamic :id route for the exact path /admin/candidates/new
// (same precedent as the existing /admin/candidates/import route), fixing
// the bug where this path used to resolve to the candidate-detail route
// with id="new".
export default function NewCandidatePage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_candidates">
        <NewCandidateContent />
      </RequireStaffAuth>
    </StaffShell>
  );
}

function NewCandidateContent() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/admin" className="mb-4 inline-flex items-center text-sm font-medium text-brand hover:underline">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("adminBackToDashboard")}
        </Link>
        <CandidateCreateForm />
      </div>
    </div>
  );
}
