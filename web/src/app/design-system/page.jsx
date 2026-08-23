import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CnicField,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChip,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  OtpField,
  Pagination,
  ProgressBar,
  SearchField,
  SessionExpiredState,
  Timeline,
  toast,
} from "../../design-system";

const CANDIDATES = [
  { id: 1, name: "Ahmed Khan", stageKey: "documentsUploaded" },
  { id: 2, name: "علی حسن", stageKey: "feePaid" },
];

export default function DesignSystemShowcasePage() {
  const { language, setLanguage, t } = useLanguage();
  const [cnic, setCnic] = useState("");
  const [otp, setOtp] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const timeline = [
    { id: "registered", label: t("registered"), status: "completed" },
    { id: "documentsUploaded", label: t("documentsUploaded"), status: "current", statusText: t("inProgress") },
    { id: "visaIssued", label: t("visaIssued"), status: "pending" },
  ];

  const columns = [
    { key: "name", header: t("adminTableCandidate"), render: (row) => row.name },
    { key: "stage", header: t("adminTableStage"), render: (row) => t(row.stageKey) },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{t("dsShowcaseTitle")}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t("dsShowcaseSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterChip selected={language === "en"} onClick={() => setLanguage("en")}>
            {t("englishLabel")}
          </FilterChip>
          <FilterChip selected={language === "ur"} onClick={() => setLanguage("ur")}>
            {t("urduLabel")}
          </FilterChip>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionButtons")}</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">{t("continue")}</Button>
          <Button variant="secondary">{t("back")}</Button>
          <Button variant="outline">{t("resendOTP")}</Button>
          <Button variant="destructive">{t("rejectAction")}</Button>
          <Button variant="text">{t("viewStatus")}</Button>
          <Button variant="primary" loading>
            {t("sendOTP")}
          </Button>
          <Button variant="primary" disabled>
            {t("verifyAndLogin")}
          </Button>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionInputs")}</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Input label={t("addressShort")} helperText={t("dsOptionalField")} />
          <Input
            label={t("emailShort")}
            requirementText={t("dsRequiredField")}
            errorMessage={t("dsFieldRequiredError")}
          />
          <CnicField label={t("cnic")} placeholder={t("enterCNIC")} value={cnic} onValueChange={setCnic} />
          <OtpField label={t("enterOTP")} value={otp} onValueChange={setOtp} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionCards")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("currentStatus")}</CardTitle>
              <CardDescription>{t("waitingForVerification")}</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{t("verified")}</Badge>
              <Badge tone="warning">{t("pending")}</Badge>
              <Badge tone="danger">{t("rejected")}</Badge>
              <Badge tone="info">{t("inProgress")}</Badge>
              <Badge tone="neutral">{t("notAvailable")}</Badge>
            </div>
          </Card>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionTable")}</h2>
        <Card noPadding>
          <DataTable columns={columns} rows={CANDIDATES} getRowId={(row) => row.id} />
          <div className="p-4">
            <Pagination
              page={page}
              pageCount={12}
              onPageChange={setPage}
              previousLabel={t("dsPreviousPage")}
              nextLabel={t("dsNextPage")}
            />
          </div>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionProgress")}</h2>
        <Card>
          <ProgressBar value={65} label={t("mobilizationProgress")} displayText={`65% ${t("complete")}`} />
          <div className="mt-6">
            <Timeline items={timeline} />
          </div>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionStates")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card noPadding>
            <LoadingState message={t("loading")} />
          </Card>
          <Card noPadding>
            <EmptyState title={t("dsEmptyTitle")} description={t("dsEmptyDescription")} />
          </Card>
          <Card noPadding>
            <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={() => {}} />
          </Card>
          <Card noPadding>
            <OfflineState
              title={t("dsOfflineTitle")}
              description={t("dsOfflineDescription")}
              retryLabel={t("retry")}
              onRetry={() => {}}
            />
          </Card>
          <Card noPadding>
            <ForbiddenState title={t("dsForbiddenTitle")} description={t("dsForbiddenDescription")} />
          </Card>
          <Card noPadding>
            <SessionExpiredState
              title={t("dsSessionExpiredTitle")}
              description={t("dsSessionExpiredDescription")}
              actionLabel={t("dsSessionExpiredAction")}
              onAction={() => {}}
            />
          </Card>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionDialog")}</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            {t("dsOpenDialog")}
          </Button>
          <Button variant="outline" onClick={() => toast.success(t("dsSampleToastMessage"))}>
            {t("dsShowToast")}
          </Button>
        </div>
        <ConfirmDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t("dsSampleDialogTitle")}
          description={t("dsSampleDialogDescription")}
          confirmLabel={t("dsDialogConfirm")}
          cancelLabel={t("dsDialogCancel")}
          closeLabel={t("dsClose")}
          confirmVariant="destructive"
          onConfirm={() => setDialogOpen(false)}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t("dsSectionSearch")}</h2>
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchField
                value={search}
                onValueChange={setSearch}
                label={t("dsSearchLabel")}
                clearLabel={t("dsClearFilters")}
                placeholder={t("adminSearchPlaceholder")}
              />
            </div>
            <div className="flex gap-2">
              <FilterChip selected={activeFilter === "all"} onClick={() => setActiveFilter("all")}>
                {t("adminAll")}
              </FilterChip>
              <FilterChip selected={activeFilter === "pending"} onClick={() => setActiveFilter("pending")}>
                {t("pending")}
              </FilterChip>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
