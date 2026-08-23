import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CnicField,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChip,
  ForbiddenState,
  List,
  LoadingState,
  OfflineState,
  OtpField,
  ProgressBar,
  SearchField,
  SessionExpiredState,
  TextField,
  Timeline,
  toast,
} from "../design-system";
import { colors, fontWeights, spacing } from "../design-system/tokens";

const CANDIDATES = [
  { id: "1", name: "Ahmed Khan", stageKey: "documentsUploaded" },
  { id: "2", name: "علی حسن", stageKey: "feePaid" },
];

function SectionHeading({ children }) {
  return (
    <Text style={{ fontSize: 18, fontWeight: fontWeights.semibold, color: colors.text.primary, marginBottom: spacing[4] }}>
      {children}
    </Text>
  );
}

export default function DesignSystemShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const [cnic, setCnic] = useState("");
  const [otp, setOtp] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const timeline = [
    { id: "registered", label: t("registered"), status: "completed" },
    { id: "documentsUploaded", label: t("documentsUploaded"), status: "current", statusText: t("inProgress") },
    { id: "visaIssued", label: t("visaIssued"), status: "pending" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[12], paddingHorizontal: spacing[6], gap: spacing[10] }}
    >
      <View>
        <Text style={{ fontSize: 24, fontWeight: fontWeights.semibold, color: colors.text.primary }}>
          {t("dsShowcaseTitle")}
        </Text>
        <Text style={{ marginTop: spacing[1], fontSize: 14, color: colors.text.secondary }}>{t("dsShowcaseSubtitle")}</Text>
        <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[4] }}>
          <FilterChip selected={language === "en"} onPress={() => setLanguage("en")}>
            {t("englishLabel")}
          </FilterChip>
          <FilterChip selected={language === "ur"} onPress={() => setLanguage("ur")}>
            {t("urduLabel")}
          </FilterChip>
        </View>
      </View>

      <View>
        <SectionHeading>{t("dsSectionButtons")}</SectionHeading>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
          <Button variant="primary" onPress={() => {}}>
            {t("continue")}
          </Button>
          <Button variant="secondary" onPress={() => {}}>
            {t("back")}
          </Button>
          <Button variant="outline" onPress={() => {}}>
            {t("resendOTP")}
          </Button>
          <Button variant="destructive" onPress={() => {}}>
            {t("rejectAction")}
          </Button>
          <Button variant="text" onPress={() => {}}>
            {t("viewStatus")}
          </Button>
          <Button variant="primary" onPress={() => {}} loading>
            {t("sendOTP")}
          </Button>
        </View>
      </View>

      <View>
        <SectionHeading>{t("dsSectionInputs")}</SectionHeading>
        <View style={{ gap: spacing[4] }}>
          <TextField label={t("emailShort")} requirementText={t("dsRequiredField")} errorMessage={t("dsFieldRequiredError")} />
          <CnicField label={t("cnic")} placeholder={t("enterCNIC")} value={cnic} onValueChange={setCnic} />
          <OtpField label={t("enterOTP")} value={otp} onValueChange={setOtp} />
        </View>
      </View>

      <View>
        <SectionHeading>{t("dsSectionCards")}</SectionHeading>
        <Card>
          <CardHeader>
            <CardTitle>{t("currentStatus")}</CardTitle>
            <CardDescription>{t("waitingForVerification")}</CardDescription>
          </CardHeader>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <Badge tone="success">{t("verified")}</Badge>
            <Badge tone="warning">{t("pending")}</Badge>
            <Badge tone="danger">{t("rejected")}</Badge>
            <Badge tone="info">{t("inProgress")}</Badge>
          </View>
        </Card>
      </View>

      <View>
        <SectionHeading>{t("dsSectionProgress")}</SectionHeading>
        <Card>
          <ProgressBar value={65} label={t("mobilizationProgress")} displayText={`65% ${t("complete")}`} />
          <View style={{ marginTop: spacing[6] }}>
            <Timeline items={timeline} />
          </View>
        </Card>
      </View>

      <View>
        <SectionHeading>{t("dsSectionStates")}</SectionHeading>
        <View style={{ gap: spacing[3] }}>
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
            <OfflineState title={t("dsOfflineTitle")} description={t("dsOfflineDescription")} retryLabel={t("retry")} onRetry={() => {}} />
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
        </View>
      </View>

      <View>
        <SectionHeading>{t("dsSectionDialog")}</SectionHeading>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Button variant="outline" onPress={() => setDialogOpen(true)}>
            {t("dsOpenDialog")}
          </Button>
          <Button variant="outline" onPress={() => toast.success(t("dsSampleToastMessage"))}>
            {t("dsShowToast")}
          </Button>
        </View>
        <ConfirmDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t("dsSampleDialogTitle")}
          description={t("dsSampleDialogDescription")}
          confirmLabel={t("dsDialogConfirm")}
          cancelLabel={t("dsDialogCancel")}
          confirmVariant="destructive"
          onConfirm={() => setDialogOpen(false)}
        />
      </View>

      <View>
        <SectionHeading>{t("dsSectionSearch")}</SectionHeading>
        <View style={{ gap: spacing[3] }}>
          <SearchField value={search} onValueChange={setSearch} label={t("dsSearchLabel")} clearLabel={t("dsClearFilters")} placeholder={t("adminSearchPlaceholder")} />
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <FilterChip selected={activeFilter === "all"} onPress={() => setActiveFilter("all")}>
              {t("adminAll")}
            </FilterChip>
            <FilterChip selected={activeFilter === "pending"} onPress={() => setActiveFilter("pending")}>
              {t("pending")}
            </FilterChip>
          </View>
          <List
            scrollEnabled={false}
            data={CANDIDATES}
            keyExtractor={(item) => item.id}
            renderItem={(item) => (
              <Card>
                <Text style={{ fontSize: 16, fontWeight: fontWeights.medium, color: colors.text.primary }}>{item.name}</Text>
                <Text style={{ marginTop: spacing[1], fontSize: 14, color: colors.text.secondary }}>{t(item.stageKey)}</Text>
              </Card>
            )}
            emptyState={{ title: t("dsEmptyTitle"), description: t("dsEmptyDescription") }}
          />
        </View>
      </View>
    </ScrollView>
  );
}
