import { useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Pressable, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Upload, CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft } from "lucide-react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { useCandidateDocuments } from "../../../features/candidate/documents/hooks/useCandidateDocuments";
import { useDocumentUpload } from "../../../features/candidate/documents/hooks/useDocumentUpload";
import { useApplicationProgress } from "../../../features/candidate/progress/hooks/useApplicationProgress";
import { useSubmitDocuments } from "../../../features/candidate/progress/hooks/useSubmitDocuments";
import { DocumentUploadPanel } from "../../../features/candidate/documents/components/DocumentUploadPanel";
import {
  Button,
  ConfirmDialog,
  LoadingState,
  ErrorState,
  OfflineState,
  SessionExpiredState,
  ForbiddenState,
  ValidationMessage,
} from "../../../design-system";
import { CANDIDATE_DOCUMENTS_ERROR_KEYS } from "../../../../../shared/candidateDocuments/errorMessages";
import { APPLICATION_PROGRESS_ERROR_KEYS } from "../../../../../shared/applicationProgress/errorMessages";
import { PCC_COMPLIANCE_STATUS_KEYS } from "../../../../../shared/candidateDocuments/statusLabels";
import { sortByPrototypeOrder } from "../../../../../shared/candidateDocuments/checklistOrder";

const STATUS_CONFIG = {
  verified: { icon: CheckCircle, color: "#10B981", bgLight: "#E6F9F0", bgDark: "#1A2E1A", labelKey: "verified" },
  pending_review: { icon: Clock, color: "#F59E0B", bgLight: "#FFF7E6", bgDark: "#2E2416", labelKey: "candidateDocumentsStatusPendingReview" },
  uploaded: { icon: Upload, color: "#0066CC", bgLight: "#E6F2FF", bgDark: "#1A2B3D", labelKey: "uploaded" },
  rejected: { icon: XCircle, color: "#EF4444", bgLight: "#FEF2F2", bgDark: "#2D1B1B", labelKey: "rejected" },
  missing: { icon: Upload, color: "#6B7280", bgLight: "#F6F6F6", bgDark: "#1E1E1E", labelKey: "candidateDocumentsStatusMissing" },
  unknown: { icon: Upload, color: "#6B7280", bgLight: "#F6F6F6", bgDark: "#1E1E1E", labelKey: "candidateDocumentsStatusUnknown" },
};

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, language } = useLanguage();
  const { logout } = useAuth();
  const checklistQuery = useCandidateDocuments();
  const progressQuery = useApplicationProgress();
  const upload = useDocumentUpload();
  const submit = useSubmitDocuments();
  useRefetchOnFocus(checklistQuery.refetch, checklistQuery.isFetching);
  useRefetchOnFocus(progressQuery.refetch, progressQuery.isFetching);

  const returnToSignIn = async () => {
    await logout("expired");
    router.replace("/login");
  };

  // Only the upload and submit mutations auto-end the session here -- their
  // errors have no dedicated confirmation screen of their own (they surface
  // inline in the upload panel / confirm dialog). The checklist query's own
  // SESSION_EXPIRED/INACTIVE_ACCOUNT render their dedicated
  // SessionExpiredState/ForbiddenState below, which end the session only
  // once the candidate confirms via that screen's own action -- never
  // silently out from under them.
  // Placed above the `fontsLoaded` early return below -- every hook here
  // must run on every render regardless of that gate, or React sees a
  // different hook order between the "still loading fonts" render and every
  // render after it (Rules of Hooks).
  useEffect(() => {
    const code = upload.mutation.error?.code ?? submit.mutation.error?.code;
    if (code === "SESSION_EXPIRED" || code === "INACTIVE_ACCOUNT") {
      returnToSignIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upload.mutation.error, submit.mutation.error]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const documents = progressQuery.data?.documents;
  const stats = {
    verified: documents?.verified ?? 0,
    pendingReview: documents?.pendingReview ?? 0,
    missing: documents?.missing ?? 0,
  };

  const renderBody = () => {
    if (checklistQuery.isLoading) {
      return <LoadingState message={t("loading")} />;
    }
    const error = checklistQuery.error;
    if (error?.code === "SESSION_EXPIRED") {
      return (
        <SessionExpiredState
          title={t("dsSessionExpiredTitle")}
          description={t("dsSessionExpiredDescription")}
          actionLabel={t("dsSessionExpiredAction")}
          onAction={returnToSignIn}
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
        />
      );
    }
    if (error) {
      return (
        <ErrorState
          message={t(CANDIDATE_DOCUMENTS_ERROR_KEYS[error.code])}
          retryLabel={t("retry")}
          onRetry={() => checklistQuery.refetch()}
        />
      );
    }

    const checklist = sortByPrototypeOrder(checklistQuery.data ?? []);

    return (
      <>
        {/* Stats */}
        <View style={{ flexDirection: "row", marginBottom: 20, marginHorizontal: -4 }}>
          <StatTile value={stats.verified} labelKey="verified" color="#10B981" bg={isDark ? "#1A2E1A" : "#E6F9F0"} isDark={isDark} t={t} />
          <StatTile
            value={stats.pendingReview}
            labelKey="candidateDocumentsStatusPendingReview"
            color="#F59E0B"
            bg={isDark ? "#2E2416" : "#FFF7E6"}
            isDark={isDark}
            t={t}
          />
          <StatTile
            value={stats.missing}
            labelKey="candidateDocumentsStatusMissing"
            color="#6B7280"
            bg={isDark ? "#1E1E1E" : "#F6F6F6"}
            isDark={isDark}
            t={t}
          />
        </View>

        {documents?.canSubmit ? (
          <View style={{ marginBottom: 20 }}>
            <Button onPress={submit.openConfirm} disabled={submit.mutation.isPending}>
              {t("applicationProgressSubmitAction")}
            </Button>
          </View>
        ) : null}

        {/* Document List */}
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
            />
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#121212" : "#F8F9FA" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: isDark ? "#121212" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#333333" : "#F0F0F0",
        }}
      >
        <Text style={{ fontSize: 28, fontFamily: "Inter_600SemiBold", color: isDark ? "#FFFFFF" : "#000000" }}>
          {t("documents")}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 80,
        }}
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
      >
        {submit.mutation.error && ["OFFLINE", "NETWORK_ERROR", "SERVER_ERROR", "RATE_LIMITED", "IN_PROGRESS", "CONFLICT"].includes(submit.mutation.error.code) ? (
          <ValidationMessage tone="error">
            {submit.mutation.error.message ?? t(APPLICATION_PROGRESS_ERROR_KEYS[submit.mutation.error.code])}
          </ValidationMessage>
        ) : null}
      </ConfirmDialog>
    </View>
  );
}

function StatTile({ value, labelKey, color, bg, isDark, t }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      <View style={{ backgroundColor: bg, borderRadius: 12, padding: 12, alignItems: "center" }}>
        <Text style={{ fontSize: 24, fontFamily: "Inter_600SemiBold", color, marginBottom: 2 }}>{value}</Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: isDark ? "#FFFFFF" : "#000000" }}>{t(labelKey)}</Text>
      </View>
    </View>
  );
}

function DocumentRow({ item, isDark, language, t, isActive, isAnyUploadPending, upload }) {
  const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;
  const canUpload = item.status === "missing";
  const canReplace = item.document !== null && item.replacementAllowed;
  const hasAction = canUpload || canReplace;
  const complianceStatus = item.document?.complianceStatus;

  const statusLine = [
    t(config.labelKey),
    item.document?.uploadedAt ? new Date(item.document.uploadedAt).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB") : null,
    item.required ? t("candidateDocumentsRequiredLabel") : null,
    complianceStatus && complianceStatus !== "current" && complianceStatus !== "not_applicable" ? t(PCC_COMPLIANCE_STATUS_KEYS[complianceStatus]) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const handlePress = () => {
    if (isAnyUploadPending && !isActive) return;
    if (isActive) {
      upload.cancelUpload();
      return;
    }
    upload.startUpload(item.requirementCode);
  };

  const actionLabel = t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction");
  const Chevron = language === "ur" ? ChevronLeft : ChevronRight;

  const rowContent = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isDark ? config.bgDark : config.bgLight,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusIcon size={20} color={config.color} />
      </View>

      <View style={{ flex: 1, marginStart: 12 }}>
        <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: isDark ? "#FFFFFF" : "#000000", marginBottom: 2 }}>
          {item.name}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: config.color }}>{statusLine}</Text>
        {item.document?.rejectionReason ? (
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 4 }}>
            {item.document.rejectionReason}
          </Text>
        ) : null}
      </View>

      {hasAction ? <Chevron size={20} color={isDark ? "#6B7280" : "#9CA3AF"} /> : null}
    </View>
  );

  return (
    <View
      style={{
        backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? "#333333" : "#E5E7EB",
      }}
    >
      {hasAction ? (
        <Pressable
          onPress={handlePress}
          disabled={isAnyUploadPending && !isActive}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          {rowContent}
        </Pressable>
      ) : (
        rowContent
      )}

      {isActive ? (
        <DocumentUploadPanel
          labelText={t(canUpload ? "candidateDocumentsUploadAction" : "candidateDocumentsReplaceAction")}
          document={upload.document}
          validationError={upload.validationError}
          uploadError={upload.mutation.error ?? null}
          isUploading={upload.mutation.isPending}
          isPccRequirement={upload.isPccRequirement}
          issuedOn={upload.issuedOn}
          onIssuedOnChange={upload.setIssuedOn}
          issuedOnError={upload.issuedOnError}
          onPickDocument={upload.pickDocument}
          onRemoveDocument={upload.removeDocument}
          onCancel={upload.cancelUpload}
          onSubmit={upload.submit}
          t={t}
        />
      ) : null}
    </View>
  );
}
