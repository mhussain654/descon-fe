import { useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronRight, ChevronLeft, ChevronDown } from "lucide-react-native";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useCandidateDocuments } from "../../../features/candidate/documents/hooks/useCandidateDocuments";
import { useDocumentUpload } from "../../../features/candidate/documents/hooks/useDocumentUpload";
import { useDocumentAccess } from "../../../features/candidate/documents/hooks/useDocumentAccess";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { useSubmitDocuments } from "../../../features/candidate/progress/hooks/useSubmitDocuments";
import { DocumentUploadPanel } from "../../../features/candidate/documents/components/DocumentUploadPanel";
import { DocumentViewPanel } from "../../../features/candidate/documents/components/DocumentViewPanel";
import { BankDetailsPanel } from "../../../features/candidate/documents/components/BankDetailsPanel";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  ErrorState,
  OfflineState,
  SessionExpiredState,
  ForbiddenState,
  ValidationMessage,
  getFontFamily,
} from "../../../design-system";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";
import { DocumentsHeader, DocumentsSummary, DocumentCardHeading, documentsStyles } from "../../../features/candidate/documents/components/DocumentsPresentation";
import { physicalTextAlign, rowDirectionTowards } from "../../../lib/layoutDirection";
import { PCC_COMPLIANCE_STATUS_KEYS } from "../../../../../shared/candidateDocuments/statusLabels";

const STATUS_CONFIG = {
  verified: { color: "#087C46", labelKey: "verified" },
  pending_review: { color: "#9A5700", labelKey: "candidateDocumentsStatusPendingReview" },
  uploaded: { color: "#0862BC", labelKey: "uploaded" },
  rejected: { color: "#B42318", labelKey: "rejected" },
  missing: { color: "#6B7280", labelKey: "pending" },
  unknown: { color: "#6B7280", labelKey: "candidateDocumentsStatusUnknown" },
};

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isDark = false;
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  const upload = useDocumentUpload();
  const submit = useSubmitDocuments();
  const documentAccess = useDocumentAccess();
  // Only one document's View/Download panel is expanded at a time, mirroring
  // the upload accordion's own single-active-row convention -- keeps the
  // screen uncluttered for candidates who may not be used to multiple
  // simultaneously expanded sections.
  const [viewOpenRequirementCode, setViewOpenRequirementCode] = useState(null);
  useRefetchOnFocus(checklistQuery.refetch, checklistQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  // Only the upload, submit and document-access requests auto-end the
  // session here -- their errors have no dedicated confirmation screen of
  // their own (they surface inline in the upload panel / confirm dialog /
  // document row). The checklist query's own SESSION_EXPIRED/INACTIVE_ACCOUNT
  // render their dedicated SessionExpiredState/ForbiddenState below, which
  // end the session only once the candidate confirms via that screen's own
  // action -- never silently out from under them.
  useEffect(() => {
    const code = upload.mutation.error?.code ?? submit.mutation.error?.code ?? documentAccess.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.mutation.error, submit.mutation.error, documentAccess.error]);

  const documents = progressQuery.data?.documents;
  const stats = {
    verified: documents?.verified ?? 0,
    pendingReview: documents?.pendingReview ?? 0,
    missing: documents?.missing ?? 0,
  };

  const renderBody = () => {
    // `isPending`, not `isLoading` -- a disabled query (auth not yet
    // restored) has `isLoading: false` (v5: isLoading = isPending &&
    // isFetching, and a disabled query never reaches isFetching) but is
    // just as "no data yet" as one that's actively fetching. Gating on
    // `isLoading` alone let that brief disabled window fall through to the
    // `checklist.length === 0` branch below (checklistQuery.data is
    // undefined -- `?? []` -- while disabled), incorrectly mounting the
    // empty-state/BankDetailsPanel tree, then unmounting it the instant
    // auth resolved and isLoading flipped true -- a mount/unmount churn
    // that could wedge later query notifications.
    if (checklistQuery.isPending) {
      return <LoadingState message={t("loading")} language={language} />;
    }
    const error = checklistQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
          language={language}
        />
      );
    }
    if (error?.code === "INACTIVE_ACCOUNT") {
      return (
        <ForbiddenState
          title={t("candidateProfileInactiveAccountTitle")}
          description={t("candidateProfileInactiveAccountDescription")}
          actionLabel={t("candidateProfileInactiveAccountAction")}
          onAction={returnToSignIn}
          language={language}
        />
      );
    }
    if (error?.code === "OFFLINE") {
      return (
        <OfflineState
          title={t("dsOfflineTitle")}
          description={t("dsOfflineDescription")}
          retryLabel={t("retry")}
          onRetry={() => checklistQuery.refetch()}
          language={language}
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => checklistQuery.refetch()}
          language={language}
        />
      );
    }

    // Already in the backend's display order -- never re-sorted here.
    const checklist = checklistQuery.data ?? [];

    if (checklist.length === 0) {
      return (
        <>
          <BankDetailsPanel isDark={isDark} t={t} language={language} onSessionEnd={returnToSignIn} />
          <EmptyState
            title={t("candidateDocumentsEmptyTitle")}
            description={t("candidateDocumentsEmptyDescription")}
            language={language}
          />
        </>
      );
    }

    return (
      <>
        <DocumentsSummary stats={stats} language={language} t={t} />

        {documents?.canSubmit ? (
          <View style={{ marginBottom: 20 }}>
            <Button onPress={submit.openConfirm} disabled={submit.mutation.isPending} language={language}>
              {t("applicationProgressSubmitAction")}
            </Button>
          </View>
        ) : null}

        <Text accessibilityRole="header" style={[documentsStyles.sectionHeading, { fontFamily: getFontFamily(language, "bold"), textAlign: physicalTextAlign(language === "ur" ? "right" : "left") }, language === "ur" && documentsStyles.urduBody]}>{t("candidateDocumentsChecklistTitle")}</Text>
        <View>
          {checklist.map((item) => (
            <DocumentRow
              key={item.requirementCode}
              item={item}
              isDark={isDark}
              language={language}
              t={t}
              isActive={upload.activeRequirementCode === item.requirementCode}
              isAnyUploadPending={upload.mutation.isPending}
              upload={upload}
              documentAccess={documentAccess}
              isViewOpen={viewOpenRequirementCode === item.requirementCode}
              onToggleView={() =>
                setViewOpenRequirementCode((current) => (current === item.requirementCode ? null : item.requirementCode))
              }
            />
          ))}
        </View>

        <BankDetailsPanel isDark={isDark} t={t} language={language} onSessionEnd={returnToSignIn} />
      </>
    );
  };

  return (
    <View style={documentsStyles.screen}>
      <StatusBar style="light" />
      <DocumentsHeader topInset={insets.top} language={language} t={t} />

      <ScrollView
        style={documentsStyles.scroll}
        contentContainerStyle={[documentsStyles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={checklistQuery.isRefetching || progressQuery.isRefetching}
            onRefresh={() => {
              checklistQuery.refetch();
              progressQuery.refetch();
            }}
            title={t("pullToRefresh")}
          />
        }
      >
        {renderBody()}
      </ScrollView>

      <ConfirmDialog
        open={submit.confirmOpen}
        onOpenChange={(open) => (open ? submit.openConfirm() : submit.closeConfirm())}
        title={t("applicationProgressConfirmTitle")}
        description={t("applicationProgressConfirmDescription")}
        confirmLabel={submit.mutation.isPending ? t("applicationProgressSubmitting") : t("applicationProgressConfirmAction")}
        cancelLabel={t("applicationProgressConfirmCancel")}
        onConfirm={submit.confirm}
        isConfirming={submit.mutation.isPending}
        language={language}
      >
        {submit.mutation.error && ["OFFLINE", "NETWORK_ERROR", "SERVER_ERROR", "RATE_LIMITED", "IN_PROGRESS", "CONFLICT"].includes(submit.mutation.error.code) ? (
          <ValidationMessage tone="error" language={language}>
            {submit.mutation.error.message ?? t(APPLICATION_PROGRESS_ERROR_KEYS[submit.mutation.error.code])}
          </ValidationMessage>
        ) : null}
      </ConfirmDialog>
    </View>
  );
}

function DocumentRow({
  item,
  isDark,
  language,
  t,
  isActive,
  isAnyUploadPending,
  upload,
  documentAccess,
  isViewOpen,
  onToggleView,
}) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unknown;
  const canUpload = item.status === "missing";
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;
  const canView = item.document !== null;
  const isViewOnly = canView && !hasAction;
  const files = item.document?.files ?? [];
  const complianceStatus = item.document?.complianceStatus;

  const isRequestingThisRow = documentAccess.isRequesting && documentAccess.targetDocumentId === item.document?.id;
  const rowAccessError =
    documentAccess.error && documentAccess.targetDocumentId === item.document?.id ? documentAccess.error : null;

  const statusLine = [
    t(config.labelKey),
    item.document?.uploadedAt ? new Date(item.document.uploadedAt).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB") : null,
    item.required ? t("candidateDocumentsRequiredLabel") : null,
    complianceStatus && complianceStatus !== "current" && complianceStatus !== "not_applicable" ? t(PCC_COMPLIANCE_STATUS_KEYS[complianceStatus]) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const handlePress = () => {
    if (isViewOnly) {
      onToggleView();
      return;
    }
    if (isAnyUploadPending && !isActive) return;
    if (isActive) {
      upload.cancelUpload();
      return;
    }
    upload.startUpload(item);
  };

  const handleQuickView = (fileId = files[0]?.id) => {
    if (isRequestingThisRow || !item.document) return;
    documentAccess.viewDocument(item.document.id, fileId);
  };

  const handleQuickDownload = (fileId = files[0]?.id) => {
    if (isRequestingThisRow || !item.document) return;
    documentAccess.downloadDocument(item.document.id, fileId);
  };

  // Keep action names for assistive technology; collapsed cards show status only.
  const actionLabel = isViewOnly
    ? item.name
    : t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction");
  const Chevron = language === "ur" ? ChevronLeft : ChevronRight;
  const rowIsExpandable = hasAction || isViewOnly;
  const rowIsExpanded = isViewOnly ? isViewOpen : isActive;

  const mainContent = <DocumentCardHeading item={item} statusLine={statusLine} statusColor={config.color} language={language} t={t} />;

  return (
    <View
      style={[documentsStyles.card, { backgroundColor: "#FFFFFF", borderColor: rowIsExpanded ? "#78B8F6" : "#E0ECF9" }]}
    >
      <View style={[documentsStyles.cardRow, { flexDirection: rowDirectionTowards(language === "ur" ? "right" : "left") }]}>
        {rowIsExpandable ? (
          <Pressable
            style={{ flex: 1 }}
            onPress={handlePress}
            disabled={!isViewOnly && isAnyUploadPending && !isActive}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ expanded: rowIsExpanded }}
          >
            <View style={[documentsStyles.cardRow, { flexDirection: rowDirectionTowards(language === "ur" ? "right" : "left") }]} >
              <View style={{ flex: 1 }}>{mainContent}</View>
              {rowIsExpanded ? <ChevronDown size={20} color="#6B7280" /> : <Chevron size={20} color="#9CA3AF" />}
            </View>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }}>{mainContent}</View>
        )}

      </View>

      {rowIsExpanded && canView ? (
        <DocumentViewPanel
          files={files}
          isRequesting={isRequestingThisRow}
          error={rowAccessError}
          onView={handleQuickView}
          onDownload={handleQuickDownload}
          t={t}
          language={language}
        />
      ) : null}

      {rowIsExpanded && !isViewOnly ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction")}
          instructions={item.instructions}
          upload={upload}
          t={t}
          language={language}
        />
      ) : null}
    </View>
  );
}
