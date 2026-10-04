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
import type { TranslationKey } from "../../../../../../shared/i18n/translations";
import { useCandidateDetail } from "../hooks/useCandidateDetail";
import { CandidateProfileCard } from "./CandidateProfileCard";
import { CandidateDocumentsSummaryCard } from "./CandidateDocumentsSummaryCard";
import { CandidatePaymentStatusCard } from "./CandidatePaymentStatusCard";
import { CandidateAiCallsCard } from "../../candidateAiCalls/components/CandidateAiCallsCard";
import { WorkflowPanel } from "../../workflow/components/WorkflowPanel";
import { FeeSettingsCard } from "../../payments/components/FeeSettingsCard";

const SECTIONS = [
  ["overview", "adminCandidateOverviewTab"],
  ["profile", "adminCandidateProfileTab"],
  ["documents", "adminCandidateDocumentsTab"],
  ["payments", "adminCandidatePaymentsTab"],
  ["records", "adminCandidateRecordsTab"],
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
      <header className="rounded-2xl bg-brand p-5 text-white shadow-md sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="rounded-xl bg-white/15 p-3">
            <UserRound aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              {t("adminCandidateDetailEyebrow")}
            </p>
            <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">
              {candidate.fullName}
            </h1>
            {assignment ? (
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
                <span dir="ltr">{assignment.referenceNumber}</span>
                <span>{assignment.country.name}</span>
                <span>{assignment.project.name}</span>
                <span>{assignment.craft.name}</span>
              </p>
            ) : null}
            <p className="mt-3 text-sm text-white/80">
              {t("adminCandidateWorkspaceHelp")}
            </p>
          </div>
          {assignment ? (
            <Badge tone="info">{assignment.currentWorkflowStage.name}</Badge>
          ) : null}
        </div>
      </header>
      <div
        role="tablist"
        aria-label={t("adminCandidateTabsLabel")}
        className="my-5 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-2"
      >
        {SECTIONS.map(([id, label], index) => (
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
              if (event.key === "End") target = SECTIONS.length - 1;
              if (event.key === "ArrowRight")
                target =
                  (index + (language === "ur" ? -1 : 1) + SECTIONS.length) %
                  SECTIONS.length;
              if (event.key === "ArrowLeft")
                target =
                  (index + (language === "ur" ? 1 : -1) + SECTIONS.length) %
                  SECTIONS.length;
              if (target !== undefined) {
                event.preventDefault();
                setSection(SECTIONS[target][0]);
                tabs.current[target]?.focus();
              }
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === id ? "bg-brand text-white shadow-sm" : "text-text-secondary hover:bg-surface-sunken"}`}
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
              <CandidateDocumentsSummaryCard candidateId={candidateId} />
              <CandidatePaymentStatusCard candidateId={candidateId} />
            </div>
            <WorkflowPanel candidateId={candidateId} section="overview" />
          </>
        ) : null}
        {section === "profile" ? (
          <CandidateProfileCard candidateId={candidateId} />
        ) : null}
        {section === "documents" ? (
          <CandidateDocumentsSummaryCard candidateId={candidateId} />
        ) : null}
        {section === "payments" ? (
          <>
            <CandidatePaymentStatusCard candidateId={candidateId} />
            <FeeSettingsCard candidateId={candidateId} />
            {canReadFees && assignment ? (
              <a
                className="inline-flex text-sm font-semibold text-brand hover:underline"
                href={`/admin/finance/payments?search=${encodeURIComponent(assignment.referenceNumber)}`}
              >
                {t("adminFeeTransactionsLink")}
              </a>
            ) : null}
          </>
        ) : null}
        {section === "records" ? (
          <>
            <WorkflowPanel candidateId={candidateId} section="records" />
            <CandidateAiCallsCard candidateId={candidateId} />
          </>
        ) : null}
        {section === "activity" ? (
          <WorkflowPanel candidateId={candidateId} section="activity" />
        ) : null}
      </section>
    </div>
  );
}
