"use client";

import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { StaffShell } from "../../../components/staff-shell";
import { WorkflowPanel } from "../../../../features/admin/workflow/components/WorkflowPanel";
import { CandidateProfileCard } from "../../../../features/admin/candidates/components/CandidateProfileCard";

// No auth guard existed here before MPS-F202/MPS-F203 -- see the identical
// note in ../../page.jsx.
export default function CandidateDetailsPage({ params }) {
  return (
    <StaffShell>
      <CandidateDetails params={params} />
    </StaffShell>
  );
}

// Personal-info, documents and payment mock plumbing (MPS-F301) has been
// removed -- CandidateProfileCard below loads and edits the real candidate
// via the real admin candidate API. Document review already has its own
// real, dedicated feature (/admin/document-reviews), and payments UI is
// explicitly out of scope for this ticket, so neither is reintroduced here.
function CandidateDetails({ params }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-surface-sunken">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <a href="/admin" className="mb-6 inline-flex items-center text-sm font-medium text-brand hover:underline">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("adminBackToDashboard")}
        </a>

        <div className="space-y-6">
          <CandidateProfileCard candidateId={params.id} />

          {/* Workflow-transition panel (MPS-F501 Phases A-C). Calls the real
              backend directly using this route's `params.id` as the
              candidate_id, same as CandidateProfileCard above. */}
          <WorkflowPanel candidateId={params.id} />
        </div>
      </div>
    </div>
  );
}
