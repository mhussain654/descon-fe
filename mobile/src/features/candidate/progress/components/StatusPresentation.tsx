import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../../../../design-system/Text';
import { Check, Clock, Plane, Route, X } from 'lucide-react-native';
import { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MeasuredSvg } from '../../../../design-system/MeasuredSvg';
import {
  JOURNEY_STATUS_KEYS,
  JOURNEY_STEP_KEYS,
  type JourneyStep,
  type MobilizationJourney,
} from '../../../../../../shared/applicationProgress/mobilizationJourney';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import { getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { isStartSide, physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { GradientIconBox } from '../../home/GradientIconBox';
import { themed, themedStyles, themedValues } from '../../../../design-system/theme';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };
/**
 * Shared text treatment for the status screens. Urdu (Nastaliq) needs a line height of about
 * twice the font size or its stacked marks and descenders are clipped, so large text must pass
 * its own `fontSize` (the default 15 keeps the 30pt line the body copy already uses).
 */
export function statusCopyStyle(language: Language, fontSize = 15) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const, ...(language === 'ur' ? { lineHeight: Math.round(fontSize * 2) } : {}) };
}

export const BUSINESS_UNIT_KEYS: Record<string, TranslationKey> = { qatar: 'buQatar', saudi_arabia: 'buSaudiArabia', uae: 'buUae', oman: 'buOman', kuwait: 'buKuwait', azerbaijan: 'buAzerbaijan', south_africa: 'buSouthAfrica' };

export function StatusHeader({ language, t, topInset }: LocaleProps & { topInset: number }) {
  const rtl = language === 'ur';
  return (
    <View style={[statusStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <MeasuredSvg>
        <Defs><LinearGradient id="statusHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2B8CD4" /><Stop offset="0.5" stopColor="#0065B3" /><Stop offset="1" stopColor="#004C87" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#statusHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke={themed("#FFFFFF", "#1E293B")} strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </MeasuredSvg>
      <View style={[statusStyles.heroRow, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
        <View style={statusStyles.flex}>
          <Text accessibilityRole="header" style={[statusStyles.title, statusCopyStyle(language, 25), { fontFamily: getFontFamily(language, 'bold') }]}>{t('status')}</Text>
          <Text style={[statusStyles.subtitle, statusCopyStyle(language)]}>{t('mobilizationProgress')}</Text>
        </View>
        <View style={statusStyles.heroIcon} accessible={false}><Plane size={29} color={themed("#0065B3", "#8FCEFF")} /></View>
      </View>
    </View>
  );
}

/** "Visa in process", "Medical rejected" ... -- the step and its status as one line. */
export function journeyStepLine(step: JourneyStep, t: (key: TranslationKey) => string): string {
  return interpolate(t('journeyCurrentStepLine'), { step: t(JOURNEY_STEP_KEYS[step.code]), status: t(JOURNEY_STATUS_KEYS[step.status]).toLowerCase() });
}

/**
 * Overall progress through the mobilization process. The current and next
 * step are not repeated here: the step list below already marks them.
 */
export function JourneySummary({ journey, updatedLabel, language, t }: LocaleProps & { journey: MobilizationJourney; updatedLabel: string | null }) {
  const percentage = Math.max(0, Math.min(100, journey.percentage));
  return (
    <View style={statusStyles.summary}>
      <View style={[statusStyles.summaryRow, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <GradientIconBox icon={Route} tone="purple" size={36} />
        <View style={statusStyles.flex}>
          <Text style={[statusStyles.summaryCount, statusCopyStyle(language, 15), { fontFamily: getFontFamily(language, 'semibold') }]}>
            {interpolate(t('journeyStepsApproved'), { approved: formatNumber(journey.approvedCount, language), total: formatNumber(journey.totalCount, language) })}
          </Text>
        </View>
        <Text style={[statusStyles.percent, { fontFamily: getFontFamily(language, 'bold') }]}>{formatNumber(percentage, language)}%</Text>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t('mobilizationProgress')} accessibilityValue={{ min: 0, max: 100, now: percentage }} style={statusStyles.track}>
        <View style={[statusStyles.fill, { width: `${percentage}%`, alignSelf: isStartSide(language === 'ur' ? 'right' : 'left') ? 'flex-start' : 'flex-end' }]} />
      </View>
      {updatedLabel ? <Text style={[statusStyles.updated, statusCopyStyle(language)]}>{t('workflowLastUpdatedPrefix')}: {updatedLabel}</Text> : null}
    </View>
  );
}

const STATUS_COLORS = themedValues(() => ({
  approved: { marker: '#10AD70', badge: themed('#DFF5E9', '#153624'), text: themed('#087C46', '#82F7C1') },
  in_process: { marker: '#0862BC', badge: themed('#DBECFF', '#16283B'), text: themed('#0862BC', '#93C7FA') },
  rejected: { marker: '#D92D20', badge: themed('#FDE8E7', '#391716'), text: themed('#B42318', '#F2A29C') },
  upcoming: { marker: themed('#E5EDF8', '#162539'), badge: themed('#E8EEF7', '#152338'), text: themed('#687A95', '#94A3B8') },
}));

const STATUS_ICONS = { approved: Check, in_process: Clock, rejected: X, upcoming: null } as const;

/** A tag label is one short word. A box wider than the word means Android never has a reason to wrap its last letter away ("مکمل" shown as "مکم"). */
const BADGE_LABEL_BOX = { minWidth: 56, textAlign: 'center' as const };

/** One step of the mobilization process. Steps not started yet carry no status tag: the client's statuses are Approved, In process and Rejected only. */
export function JourneyStepCard({ step, isLast, dateLabel, language, t, children }: LocaleProps & { step: JourneyStep; isLast: boolean; dateLabel: string | null; children?: ReactNode }) {
  const colors = STATUS_COLORS[step.status];
  const Icon = STATUS_ICONS[step.status];
  const tone = { approved: statusStyles.completed, in_process: statusStyles.current, rejected: statusStyles.rejected, upcoming: statusStyles.upcoming }[step.status];
  return (
    <View style={[statusStyles.stageRow, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      <View style={statusStyles.rail} accessible={false}>
        <View style={[statusStyles.marker, { backgroundColor: colors.marker }]}>
          {Icon ? <Icon size={18} color="#FFFFFF" strokeWidth={2.5} /> : <Text style={[statusStyles.position, { fontFamily: getFontFamily(language, 'semibold') }]}>{formatNumber(step.position, language)}</Text>}
        </View>
        {!isLast ? <View style={[statusStyles.connector, step.status === 'approved' && statusStyles.connectorCompleted]} /> : null}
      </View>
      <View testID={`status-step-${step.code}`} style={[statusStyles.stageCard, tone]}>
        <View style={[statusStyles.stageHeading, { flexDirection: rowDirectionTowards('left') }]}>
          <Text style={[statusStyles.stageName, statusCopyStyle(language), { fontFamily: getFontFamily(language, step.status === 'in_process' ? 'bold' : 'semibold') }]}>{t(JOURNEY_STEP_KEYS[step.code])}</Text>
          {step.status !== 'upcoming' ? (
            <View style={[statusStyles.badge, { backgroundColor: colors.badge }]}>
              <Text style={[statusStyles.badgeText, statusCopyStyle(language), BADGE_LABEL_BOX, { color: colors.text, fontFamily: getFontFamily(language, 'medium') }]}>{t(JOURNEY_STATUS_KEYS[step.status])}</Text>
            </View>
          ) : null}
        </View>
        {dateLabel ? <Text style={[statusStyles.date, statusCopyStyle(language)]}>{dateLabel}</Text> : null}
        {children}
      </View>
    </View>
  );
}

export const statusStyles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: themed('#F0F7FF', '#0F172A') },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0065B3' },
  heroRow: { alignItems: 'center', gap: spacing[3], marginTop: 0 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 34, color: '#FFFFFF' },
  subtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[1] },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: themed('#EAFBFF', '#122A30'), alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: themed('#F0F7FF', '#0F172A') },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  summary: { borderRadius: 20, backgroundColor: themed('#FFFFFF', '#1E293B'), borderWidth: 1, borderColor: themed('#DFEAF8', '#334155'), padding: spacing[4], marginBottom: spacing[5], ...elevation.sm },
  summaryRow: { gap: spacing[3], alignItems: 'center' },
  summaryCount: { fontSize: 21, lineHeight: 29, color: themed('#172B4D', '#A9BFE5') },
  percent: { fontSize: 26, color: themed('#0862BC', '#93C7FA') },
  track: { height: 8, borderRadius: 4, backgroundColor: themed('#E7F0FC', '#334155'), overflow: 'hidden', marginTop: spacing[3] },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#2B8CD4' },
  updated: { fontSize: 11, color: themed('#687A95', '#94A3B8'), marginTop: spacing[2] },
  sectionTitle: { fontSize: 16, lineHeight: 24, color: themed('#172B4D', '#A9BFE5'), marginBottom: spacing[3] },
  stageRow: { gap: spacing[3] },
  rail: { width: 32, alignItems: 'center' },
  marker: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: spacing[3] },
  position: { fontSize: 12, color: themed('#687A95', '#94A3B8') },
  connector: { width: 2, flex: 1, backgroundColor: themed('#D9E5F5', '#334155'), marginTop: spacing[1], minHeight: 18 },
  connectorCompleted: { backgroundColor: '#89D9B3' },
  stageCard: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, padding: spacing[3], marginBottom: spacing[3] },
  completed: { backgroundColor: themed('#F0FBF5', '#1E293B'), borderColor: themed('#C7EAD9', '#334155') },
  current: { backgroundColor: themed('#FFFFFF', '#1E293B'), borderColor: '#6DAEF5', ...elevation.sm },
  upcoming: { backgroundColor: themed('#F8FAFE', '#1E293B'), borderColor: themed('#DFE8F5', '#334155') },
  rejected: { backgroundColor: themed('#FFF5F4', '#1E293B'), borderColor: themed('#F5C2BD', '#334155') },
  stageHeading: { alignItems: 'flex-start', gap: spacing[2] },
  stageName: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 22, color: themed('#172B4D', '#A9BFE5') },
  date: { fontSize: 11, lineHeight: 18, color: themed('#687A95', '#94A3B8'), marginTop: spacing[1] },
  badge: { borderRadius: 7, paddingHorizontal: spacing[2], paddingVertical: spacing[1], flexShrink: 0, maxWidth: '48%' },
  badgeText: { fontSize: 10, lineHeight: 16 },
  download: { height: 34, backgroundColor: themed('#E6F8EE', '#133322'), borderColor: themed('#A1DCBD', '#334155'), borderRadius: 10, alignSelf: 'flex-start' },
  outcomeText: { fontSize: 12, lineHeight: 20 },
  downloadTextUrdu: { fontSize: 10, lineHeight: 26 },
  downloadText: { fontSize: 12, color: themed('#087443', '#83F6C2') },
  history: { marginTop: 0, backgroundColor: themed('#FFFFFF', '#1E293B'), borderRadius: 20, padding: spacing[4], borderWidth: 1, borderColor: themed('#DFEAF8', '#334155') },
  historyRow: { gap: spacing[2], borderTopWidth: 1, borderTopColor: themed('#EDF2FA', '#334155'), paddingVertical: spacing[3], alignItems: 'flex-start' },
  historyName: { flex: 1, minWidth: 0, fontSize: 13, color: themed('#172B4D', '#A9BFE5') },
  historyDate: { fontSize: 11, color: themed('#687A95', '#94A3B8'), maxWidth: '40%' },
  empty: { padding: spacing[4], borderRadius: 18, backgroundColor: themed('#FFFFFF', '#1E293B'), borderWidth: 1, borderColor: themed('#DFEAF8', '#334155') },
}));
