"use client";

import { ArrowLeft, UserRound } from "lucide-react";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { StaffShell } from "../../../components/staff-shell";
import { WorkflowPanel } from "../../../../features/admin/workflow/components/WorkflowPanel";
import { CandidateProfileCard } from "../../../../features/admin/candidates/components/CandidateProfileCard";
import { CandidateDocumentsSummaryCard } from "../../../../features/admin/candidates/components/CandidateDocumentsSummaryCard";
import { CandidatePaymentStatusCard } from "../../../../features/admin/candidates/components/CandidatePaymentStatusCard";
import { CandidateAiCallsCard } from "../../../../features/admin/candidateAiCalls/components/CandidateAiCallsCard";

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
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white"><UserRound className="h-5 w-5" /></div><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t("adminCandidateDetailEyebrow")}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t("adminCandidateDetailTitle")}</h1><p className="mt-1 text-sm text-white/80">{t("adminCandidateDetailSubtitle")}</p></div></div>
          <a href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20"><ArrowLeft className="me-2 h-4 w-4" />{t("adminBackToDashboard")}</a>
        </div>
      </div>

      <div className="space-y-6">
        <CandidateProfileCard candidateId={params.id} />

        <div className="grid gap-6 lg:grid-cols-2 lg:[&>*]:h-full">
          <CandidatePaymentStatusCard candidateId={params.id} />
          <CandidateDocumentsSummaryCard candidateId={params.id} />
        </div>

        <CandidateAiCallsCard candidateId={params.id} />

        {/* Workflow-transition panel (MPS-F501 Phases A-C). Calls the real
            backend directly using this route's `params.id` as the
            candidate_id, same as CandidateProfileCard above. */}
        <WorkflowPanel candidateId={params.id} />
      </div>
    </div>
  );
}
