"use client";

import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { StaffShell } from "../../../components/staff-shell";
import { WorkflowPanel } from "../../../../features/admin/workflow/components/WorkflowPanel";
import { CandidateProfileCard } from "../../../../features/admin/candidates/components/CandidateProfileCard";
import { CandidateDocumentsSummaryCard } from "../../../../features/admin/candidates/components/CandidateDocumentsSummaryCard";
import { CandidatePaymentStatusCard } from "../../../../features/admin/candidates/components/CandidatePaymentStatusCard";

// No auth guard existed here before MPS-F202/MPS-F203 -- see the identical
// note in ../../page.jsx.
export default function CandidateDetailsPage({ params }) {
  return (
    <StaffShell>
      <CandidateDetails params={params} />
    </StaffShell>
  );
}

// Personal-info/documents/payment mock plumbing (MPS-F301) was removed here
// long before this workspace existed. CandidateProfileCard loads/edits the
// real candidate; WorkflowPanel drives real workflow transitions (MPS-F501).
// The two new cards below (MPS-F303) are real, but deliberately thin:
// document review already has its own dedicated feature
// (/admin/document-reviews) -- CandidateDocumentsSummaryCard only
// summarizes and links into it, never reimplements review actions here --
// and there is no admin/staff payment endpoint at all (the only payment API
// is candidate-self-service only), so CandidatePaymentStatusCard derives a
// real status from the workflow timeline instead of inventing one.
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

          <CandidatePaymentStatusCard candidateId={params.id} />

          <CandidateDocumentsSummaryCard candidateId={params.id} />

          {/* Workflow-transition panel (MPS-F501 Phases A-C). Calls the real
              backend directly using this route's `params.id` as the
              candidate_id, same as CandidateProfileCard above. */}
          <WorkflowPanel candidateId={params.id} />
        </div>
      </div>
    </div>
  );
}
