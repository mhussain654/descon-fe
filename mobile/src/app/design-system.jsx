import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
  return <Text style={styles.sectionHeading}>{children}</Text>;
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
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[12] },
      ]}
    >
      <View>
        <Text style={styles.title}>{t("dsShowcaseTitle")}</Text>
        <Text style={styles.subtitle}>{t("dsShowcaseSubtitle")}</Text>
        <View style={styles.languageRow}>
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
        <View style={styles.buttonRow}>
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
        <View style={styles.inputsColumn}>
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
          <View style={styles.badgeRow}>
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
          <View style={styles.timelineWrapper}>
            <Timeline items={timeline} />
          </View>
        </Card>
      </View>

      <View>
        <SectionHeading>{t("dsSectionStates")}</SectionHeading>
        <View style={styles.statesColumn}>
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
        <View style={styles.dialogRow}>
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
        <View style={styles.searchColumn}>
          <SearchField value={search} onValueChange={setSearch} label={t("dsSearchLabel")} clearLabel={t("dsClearFilters")} placeholder={t("adminSearchPlaceholder")} />
          <View style={styles.filterRow}>
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
                <Text style={styles.listItemName}>{item.name}</Text>
                <Text style={styles.listItemStage}>{t(item.stageKey)}</Text>
              </Card>
            )}
            emptyState={{ title: t("dsEmptyTitle"), description: t("dsEmptyDescription") }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.surface.background },
  content: { paddingHorizontal: spacing[6], gap: spacing[10] },
  title: { fontSize: 24, fontWeight: fontWeights.semibold, color: colors.text.primary },
  subtitle: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary },
  languageRow: { flexDirection: "row", gap: spacing[2], marginTop: spacing[4] },
  sectionHeading: { fontSize: 18, fontWeight: fontWeights.semibold, color: colors.text.primary, marginBottom: spacing[4] },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  inputsColumn: { gap: spacing[4] },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  timelineWrapper: { marginTop: spacing[6] },
  statesColumn: { gap: spacing[3] },
  dialogRow: { flexDirection: "row", gap: spacing[3] },
  searchColumn: { gap: spacing[3] },
  filterRow: { flexDirection: "row", gap: spacing[2] },
  listItemName: { fontSize: 16, fontWeight: fontWeights.medium, color: colors.text.primary },
  listItemStage: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary },
});
