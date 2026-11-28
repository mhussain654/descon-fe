import { useEffect, useRef, useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../../contexts/StaffAuthContext";
import {
  Badge,
  ErrorState,
  LoadingState,
  RetryBanner,
  ForbiddenState,
} from "../../../../design-system";
import { ADMIN_CANDIDATE_ERROR_KEYS } from "../../../../../../shared/adminCandidates/errorMessages";
import { displayRegistrationNumber } from "../../../../../../shared/registrationNumber";
import type { TranslationKey } from "../../../../../../shared/i18n/translations";
import { useCandidateDetail } from "../hooks/useCandidateDetail";
import { CandidateProfileCard } from "./CandidateProfileCard";
import { ProfilePhotoReviewCard } from "./ProfilePhotoReviewCard";
import { CandidateDocumentsSummaryCard } from "./CandidateDocumentsSummaryCard";
import { CandidateDocumentsReview } from "./CandidateDocumentsReview";
import { CandidateUploadedDocumentsCard } from "../../uploadedDocuments/CandidateUploadedDocumentsCard";
import { CandidatePaymentStatusCard } from "./CandidatePaymentStatusCard";
import { CandidateAiCallsCard } from "../../candidateAiCalls/components/CandidateAiCallsCard";
import { CandidateSmsCard } from "../../candidateSms/components/CandidateSmsCard";
import { WorkflowPanel } from "../../workflow/components/WorkflowPanel";
import { WorkflowCorrectionsCard } from "../../workflowCorrections/components/WorkflowCorrectionsCard";
import { FeeSettingsCard } from "../../payments/components/FeeSettingsCard";

const SECTIONS = [
  ["overview", "adminCandidateOverviewTab"],
  ["profile", "adminCandidateProfileTab"],
  ["documents", "adminCandidateDocumentsTab"],
  ["payments", "adminCandidatePaymentsTab"],
  ["records", "adminCandidateRecordsTab"],
  ["mobilization", "adminCandidateMobilizationTab"],
  ["aiCalls", "adminCandidateAiCallsTab"],
  ["sms", "adminCandidateSmsTab"],
  ["activity", "adminCandidateActivityTab"],
] as const;
type Section = (typeof SECTIONS)[number][0];
export function CandidateWorkspace({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const [section, setSection] = useState<Section>("overview");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const query = useCandidateDetail(candidateId);
  useEffect(() => {
    if (
      query.error?.code === "SESSION_EXPIRED" ||
      query.error?.code === "INACTIVE_ACCOUNT"
    )
      signOut(query.error.code === "SESSION_EXPIRED" ? "expired" : "manual");
  }, [query.error, signOut]);
  if (query.isLoading) return <LoadingState message={t("loading")} />;
  if (
    query.error?.code === "SESSION_EXPIRED" ||
    query.error?.code === "INACTIVE_ACCOUNT"
  )
    return null;
  if (query.error?.code === "FORBIDDEN")
    return (
      <ForbiddenState
        title={t("dsForbiddenTitle")}
        description={t("staffAuthForbiddenError")}
      />
    );
  if (!query.data)
    return (
      <ErrorState
        message={
          query.error?.message ||
          t(
            query.error
              ? (ADMIN_CANDIDATE_ERROR_KEYS[query.error.code] as TranslationKey)
              : "somethingWentWrong",
          )
        }
        retryLabel={t("retry")}
        onRetry={() => query.refetch()}
      />
    );
  const candidate = query.data;
  const assignment = candidate.assignment;
  const canReadFees =
    hasPermission("view_payments") || hasPermission("manage_payments");
  // Only staff who can place calls get the AI calls tab, and only staff who
  // can send SMS get the SMS tab.
  const sections = SECTIONS.filter(
    ([id]) =>
      (id !== "aiCalls" || hasPermission("trigger_ai_calls")) &&
      (id !== "sms" || hasPermission("send_candidate_sms")),
  );
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6"
      dir={language === "ur" ? "rtl" : "ltr"}
    >
      {query.error ? (
        <RetryBanner
          message={query.error.message || t("somethingWentWrong")}
          retryLabel={t("retry")}
          onRetry={() => query.refetch()}
        />
      ) : null}
      <a
        href="/admin"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("adminBackToDashboard")}
      </a>
      {/* On phones the header keeps only what staff need -- name, numbers and
          stage -- so the candidate's actual details start near the top. */}
      <header className="rounded-2xl bg-brand p-4 text-white shadow-md sm:p-6">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <span className="hidden rounded-xl bg-white/15 p-3 sm:block">
            <UserRound aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <p className="hidden text-xs font-semibold uppercase tracking-wider text-white/80 sm:block">
              {t("adminCandidateDetailEyebrow")}
            </p>
            <h1 className="break-words text-xl font-semibold sm:mt-1 sm:text-3xl">
              {candidate.fullName}
            </h1>
            {assignment ? (
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-white/90 sm:mt-2 sm:gap-x-4 sm:gap-y-1">
                <span dir="ltr">
                  {t("adminCandidateRegistrationNumberShortLabel")}:{" "}
                  {displayRegistrationNumber(assignment.registrationNumber) || t("adminCandidateRegistrationNumberNotSet")}
                </span>
                <span>{assignment.country.name}</span>
                <span>{assignment.project.name}</span>
                <span>{assignment.craft.name}</span>
              </p>
            ) : null}
            <p className="mt-3 hidden text-sm text-white/80 sm:block">
              {t("adminCandidateWorkspaceHelp")}
            </p>
          </div>
          {assignment ? (
            <Badge tone="info">{assignment.currentWorkflowStage.name}</Badge>
          ) : null}
        </div>
      </header>
      {assignment && assignment.registrationNumber === null ? (
        <div role="alert" className="mt-5 rounded-xl border border-warning bg-warning-subtle p-4 text-warning-emphasis">
          <p className="font-semibold">{t("adminCandidateRegistrationNumberMissingTitle")}</p>
          <p className="mt-1 text-sm">{t("adminCandidateRegistrationNumberMissingBody")}</p>
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label={t("adminCandidateTabsLabel")}
        className="my-4 flex gap-2 overflow-x-auto rounded-xl border border-border bg-surface p-2 sm:my-5 sm:flex-wrap"
      >
        {sections.map(([id, label], index) => (
          <button
            key={id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`candidate-tab-${id}`}
            aria-controls={`candidate-panel-${id}`}
            aria-selected={section === id}
            tabIndex={section === id ? 0 : -1}
            onClick={() => setSection(id)}
            onKeyDown={(event) => {
              let target: number | undefined;
              if (event.key === "Home") target = 0;
              if (event.key === "End") target = sections.length - 1;
              if (event.key === "ArrowRight")
                target =
                  (index + (language === "ur" ? -1 : 1) + sections.length) %
                  sections.length;
              if (event.key === "ArrowLeft")
                target =
                  (index + (language === "ur" ? 1 : -1) + sections.length) %
                  sections.length;
              if (target !== undefined) {
                event.preventDefault();
                setSection(sections[target][0]);
                tabs.current[target]?.focus();
              }
            }}
            className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === id ? "bg-brand text-white shadow-sm" : "text-text-secondary hover:bg-surface-sunken"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        tabIndex={0}
        id={`candidate-panel-${section}`}
        aria-labelledby={`candidate-tab-${section}`}
        className="space-y-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {section === "overview" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <CandidateDocumentsSummaryCard candidateId={candidateId} onOpenDocuments={() => setSection("documents")} />
              <CandidatePaymentStatusCard candidateId={candidateId} />
            </div>
            <WorkflowPanel candidateId={candidateId} section="overview" />
            <WorkflowCorrectionsCard candidateId={candidateId} />
          </>
        ) : null}
        {section === "profile" ? (
          <>
            <ProfilePhotoReviewCard candidateId={candidateId} />
            <CandidateProfileCard candidateId={candidateId} />
          </>
        ) : null}
        {section === "documents" ? (
          <div className="space-y-6">
            <CandidateDocumentsReview candidateId={candidateId} />
            {/* Developer-only: what the candidate uploaded, submitted or not (view only). */}
            {hasPermission("view_uploaded_documents") ? <CandidateUploadedDocumentsCard candidateId={candidateId} /> : null}
          </div>
        ) : null}
        {section === "payments" ? (
          <>
            <CandidatePaymentStatusCard candidateId={candidateId} />
            <FeeSettingsCard candidateId={candidateId} />
            {canReadFees && assignment ? (
              <a
                className="inline-flex text-sm font-semibold text-brand hover:underline"
                href={`/admin/finance/payments?search=${encodeURIComponent(displayRegistrationNumber(assignment.registrationNumber) || candidate.fullName)}`}
              >
                {t("adminFeeTransactionsLink")}
              </a>
            ) : null}
          </>
        ) : null}
        {section === "records" ? (
          <WorkflowPanel candidateId={candidateId} section="records" />
        ) : null}
        {section === "mobilization" ? (
          <WorkflowPanel candidateId={candidateId} section="mobilization" />
        ) : null}
        {section === "aiCalls" ? (
          <CandidateAiCallsCard candidateId={candidateId} />
        ) : null}
        {section === "sms" ? <CandidateSmsCard candidateId={candidateId} /> : null}
        {section === "activity" ? (
          <WorkflowPanel candidateId={candidateId} section="activity" />
        ) : null}
      </section>
    </div>
  );
}
