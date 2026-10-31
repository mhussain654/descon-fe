import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };
/**
 * Shared text treatment for the status screens. Urdu (Nastaliq) needs a line height of about
 * twice the font size or its stacked marks and descenders are clipped, so large text must pass
 * its own `fontSize` (the default 15 keeps the 30pt line the body copy already uses).
 */
export function statusCopyStyle(language: Language, fontSize = 15) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const, ...(language === 'ur' ? { lineHeight: Math.round(fontSize * 2) } : {}) };
}

const BUSINESS_UNIT_KEYS: Record<string, TranslationKey> = { qatar: 'buQatar', saudi_arabia: 'buSaudiArabia', uae: 'buUae', oman: 'buOman', kuwait: 'buKuwait', azerbaijan: 'buAzerbaijan', south_africa: 'buSouthAfrica' };

export function StatusHeader({ language, t, topInset, countryCode }: LocaleProps & { topInset: number; countryCode?: string }) {
  const rtl = language === 'ur';
  return (
    <View style={[statusStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <MeasuredSvg>
        <Defs><LinearGradient id="statusHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2B8CD4" /><Stop offset="0.5" stopColor="#0065B3" /><Stop offset="1" stopColor="#004C87" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#statusHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </MeasuredSvg>
      <View style={[statusStyles.heroRow, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
        <View style={statusStyles.flex}>
          <Text accessibilityRole="header" style={[statusStyles.title, statusCopyStyle(language, 25), { fontFamily: getFontFamily(language, 'bold') }]}>{t('status')}</Text>
          <Text style={[statusStyles.subtitle, statusCopyStyle(language)]}>{t('mobilizationProgress')}</Text>
        </View>
        <View style={statusStyles.heroIcon} accessible={false}><Plane size={29} color="#0065B3" /></View>
      </View>
      {countryCode && BUSINESS_UNIT_KEYS[countryCode] ? <Text style={[statusStyles.businessUnit, statusCopyStyle(language)]}>{t('candidateProfileBusinessUnitLabel')}: {t(BUSINESS_UNIT_KEYS[countryCode])}</Text> : null}
    </View>
  );
}

/** "Visa in process", "Medical rejected" ... -- the step and its status as one line. */
export function journeyStepLine(step: JourneyStep, t: (key: TranslationKey) => string): string {
  return interpolate(t('journeyCurrentStepLine'), { step: t(JOURNEY_STEP_KEYS[step.code]), status: t(JOURNEY_STATUS_KEYS[step.status]).toLowerCase() });
}

/** The candidate's current status and next step (all they need, per the client), with overall progress. */
export function JourneySummary({ journey, updatedLabel, language, t }: LocaleProps & { journey: MobilizationJourney; updatedLabel: string | null }) {
  const percentage = Math.max(0, Math.min(100, journey.percentage));
  const current = journey.current;
  return (
    <View style={statusStyles.summary}>
      {current ? (
        <View style={statusStyles.currentStatus}>
          <Text style={[statusStyles.summaryLabel, statusCopyStyle(language)]}>{t('journeyCurrentStatusLabel')}</Text>
          <Text style={[statusStyles.currentStatusName, statusCopyStyle(language, 18), { fontFamily: getFontFamily(language, 'bold'), color: STATUS_COLORS[current.status].text }]}>
            {journeyStepLine(current, t)}
          </Text>
        </View>
      ) : null}
      <View style={statusStyles.currentStatus}>
        <Text style={[statusStyles.summaryLabel, statusCopyStyle(language)]}>{t('journeyNextStepLabel')}</Text>
        <Text style={[statusStyles.nextStepName, statusCopyStyle(language, 16), { fontFamily: getFontFamily(language, 'semibold') }]}>
          {journey.next ? t(JOURNEY_STEP_KEYS[journey.next.code]) : t('journeyAllStepsApproved')}
        </Text>
      </View>
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

const STATUS_COLORS = {
  approved: { marker: '#10AD70', badge: '#DFF5E9', text: '#087C46' },
  in_process: { marker: '#0862BC', badge: '#DBECFF', text: '#0862BC' },
  rejected: { marker: '#D92D20', badge: '#FDE8E7', text: '#B42318' },
  upcoming: { marker: '#E5EDF8', badge: '#E8EEF7', text: '#687A95' },
} as const;

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

export const statusStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0065B3' },
  businessUnit: { marginTop: spacing[2], color: '#FFFFFF', fontSize: 12, lineHeight: 22 },
  heroRow: { alignItems: 'center', gap: spacing[3], marginTop: 0 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 34, color: '#FFFFFF' },
  subtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[1] },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#EAFBFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F0F7FF' },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  summary: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8', padding: spacing[4], marginBottom: spacing[5], ...elevation.sm },
  currentStatus: { marginBottom: spacing[3], paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: '#DFEAF8' },
  currentStatusName: { fontSize: 18, color: '#0862BC' },
  nextStepName: { fontSize: 16, color: '#172B4D' },
  summaryRow: { gap: spacing[3], alignItems: 'center' },
  summaryLabel: { fontSize: 12, lineHeight: 19, color: '#687A95' },
  summaryCount: { fontSize: 21, lineHeight: 29, color: '#172B4D' },
  percent: { fontSize: 26, color: '#0862BC' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E7F0FC', overflow: 'hidden', marginTop: spacing[3] },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#2B8CD4' },
  updated: { fontSize: 11, color: '#687A95', marginTop: spacing[2] },
  sectionTitle: { fontSize: 16, lineHeight: 24, color: '#172B4D', marginBottom: spacing[3] },
  stageRow: { gap: spacing[3] },
  rail: { width: 32, alignItems: 'center' },
  marker: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: spacing[3] },
  position: { fontSize: 12, color: '#687A95' },
  connector: { width: 2, flex: 1, backgroundColor: '#D9E5F5', marginTop: spacing[1], minHeight: 18 },
  connectorCompleted: { backgroundColor: '#89D9B3' },
  stageCard: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, padding: spacing[3], marginBottom: spacing[3] },
  completed: { backgroundColor: '#F0FBF5', borderColor: '#C7EAD9' },
  current: { backgroundColor: '#FFFFFF', borderColor: '#6DAEF5', ...elevation.sm },
  upcoming: { backgroundColor: '#F8FAFE', borderColor: '#DFE8F5' },
  rejected: { backgroundColor: '#FFF5F4', borderColor: '#F5C2BD' },
  stageHeading: { alignItems: 'flex-start', gap: spacing[2] },
  stageName: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 22, color: '#172B4D' },
  date: { fontSize: 11, lineHeight: 18, color: '#687A95', marginTop: spacing[1] },
  badge: { borderRadius: 7, paddingHorizontal: spacing[2], paddingVertical: spacing[1], flexShrink: 0, maxWidth: '48%' },
  badgeText: { fontSize: 10, lineHeight: 16 },
  download: { height: 34, backgroundColor: '#E6F8EE', borderColor: '#A1DCBD', borderRadius: 10, alignSelf: 'flex-start' },
  outcomeText: { fontSize: 12, lineHeight: 20 },
  downloadTextUrdu: { fontSize: 10, lineHeight: 26 },
  downloadText: { fontSize: 12, color: '#087443' },
  history: { marginTop: 0, backgroundColor: '#FFFFFF', borderRadius: 20, padding: spacing[4], borderWidth: 1, borderColor: '#DFEAF8' },
  historyRow: { gap: spacing[2], borderTopWidth: 1, borderTopColor: '#EDF2FA', paddingVertical: spacing[3], alignItems: 'flex-start' },
  historyName: { flex: 1, minWidth: 0, fontSize: 13, color: '#172B4D' },
  historyDate: { fontSize: 11, color: '#687A95', maxWidth: '40%' },
  empty: { padding: spacing[4], borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8' },
});
