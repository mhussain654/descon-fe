import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Clock, Plane, Route } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ApplicationProgressWorkflow, WorkflowTimelineStage } from '../../../../../../shared/applicationProgress/types';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { formatNumber } from '../../../../../../shared/i18n/locale';
import { getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { isStartSide, physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { BrandHeader } from '../../../onboarding/BrandHeader';
import { GradientIconBox } from '../../home/GradientIconBox';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };
export function statusCopyStyle(language: Language) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const, ...(language === 'ur' ? { lineHeight: 30 } : {}) };
}

export function StatusHeader({ language, t, topInset }: LocaleProps & { topInset: number }) {
  const rtl = language === 'ur';
  return (
    <View style={[statusStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false} pointerEvents="none">
        <Defs><LinearGradient id="statusHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#16A5EE" /><Stop offset="0.5" stopColor="#0873DF" /><Stop offset="1" stopColor="#0649B9" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#statusHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </Svg>
      <BrandHeader language={language} primary={t('brandNamePrimary')} secondary={t('brandNameSecondary')} tileAtRowStart={isStartSide(rtl ? 'right' : 'left')} />
      <View style={[statusStyles.heroRow, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
        <View style={statusStyles.flex}>
          <Text accessibilityRole="header" style={[statusStyles.title, statusCopyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('status')}</Text>
          <Text style={[statusStyles.subtitle, statusCopyStyle(language)]}>{t('mobilizationProgress')}</Text>
        </View>
        <View style={statusStyles.heroIcon} accessible={false}><Plane size={29} color="#0873DF" /></View>
      </View>
    </View>
  );
}

export function StatusProgressSummary({ workflow, updatedLabel, language, t }: LocaleProps & { workflow: ApplicationProgressWorkflow; updatedLabel: string | null }) {
  const percentage = Math.max(0, Math.min(100, workflow.progressPercentage));
  return (
    <View style={statusStyles.summary}>
      <View style={[statusStyles.summaryRow, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <GradientIconBox icon={Route} tone="purple" size={36} />
        <View style={statusStyles.flex}>
          <Text style={[statusStyles.summaryLabel, statusCopyStyle(language)]}>{t('workflowStagesCompletedPrefix')}</Text>
          <Text style={[statusStyles.summaryCount, statusCopyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{formatNumber(workflow.completedCount, language)} / {formatNumber(workflow.totalCount, language)}</Text>
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

export function StatusStageCard({ stage, isLast, dateLabel, language, t, children }: LocaleProps & { stage: WorkflowTimelineStage; isLast: boolean; dateLabel: string | null; children?: ReactNode }) {
  const completed = stage.status === 'completed';
  const current = stage.status === 'current';
  const tone = completed ? statusStyles.completed : current ? statusStyles.current : statusStyles.upcoming;
  const color = completed ? '#087C46' : current ? '#0862BC' : '#687A95';
  const Icon = completed ? Check : current ? Clock : null;
  return (
    <View style={[statusStyles.stageRow, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      <View style={statusStyles.rail} accessible={false}>
        <View style={[statusStyles.marker, { backgroundColor: completed ? '#10AD70' : current ? '#0862BC' : '#E5EDF8' }]}>
          {Icon ? <Icon size={18} color="#FFFFFF" strokeWidth={2.5} /> : <Text style={[statusStyles.position, { fontFamily: getFontFamily(language, 'semibold') }]}>{formatNumber(stage.position, language)}</Text>}
        </View>
        {!isLast ? <View style={[statusStyles.connector, completed && statusStyles.connectorCompleted]} /> : null}
      </View>
      <View style={[statusStyles.stageCard, tone]}>
        <Text style={[statusStyles.stageName, statusCopyStyle(language), { fontFamily: getFontFamily(language, current ? 'bold' : 'semibold') }]}>{stage.name}</Text>
        {dateLabel ? <Text style={[statusStyles.date, statusCopyStyle(language)]}>{dateLabel}</Text> : null}
        <View style={[statusStyles.badge, { backgroundColor: completed ? '#DFF5E9' : current ? '#DBECFF' : '#E8EEF7', alignSelf: isStartSide(language === 'ur' ? 'right' : 'left') ? 'flex-start' : 'flex-end' }]}>
          <Text style={[statusStyles.badgeText, statusCopyStyle(language), { color, fontFamily: getFontFamily(language, 'medium') }]}>{t(completed ? 'candidateStatusCompleted' : current ? 'inProgress' : 'candidateStatusUpcoming')}</Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export const statusStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0873DF' },
  heroRow: { alignItems: 'center', gap: spacing[3], marginTop: spacing[4] },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 34, color: '#FFFFFF' },
  subtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[1] },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#EAFBFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F0F7FF' },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  summary: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8', padding: spacing[4], marginBottom: spacing[5], ...elevation.sm },
  summaryRow: { gap: spacing[3], alignItems: 'center' },
  summaryLabel: { fontSize: 12, lineHeight: 19, color: '#687A95' },
  summaryCount: { fontSize: 21, lineHeight: 29, color: '#172B4D' },
  percent: { fontSize: 26, color: '#0862BC' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E7F0FC', overflow: 'hidden', marginTop: spacing[3] },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#16A5EE' },
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
  stageName: { fontSize: 14, lineHeight: 22, color: '#172B4D' },
  date: { fontSize: 11, lineHeight: 18, color: '#687A95', marginTop: spacing[1] },
  badge: { borderRadius: 7, paddingHorizontal: spacing[2], paddingVertical: spacing[1], marginTop: spacing[2] },
  badgeText: { fontSize: 10, lineHeight: 16 },
  download: { height: 34, backgroundColor: '#E6F8EE', borderColor: '#A1DCBD', borderRadius: 10, alignSelf: 'flex-start' },
  outcomeText: { fontSize: 12, lineHeight: 20 },
  downloadTextUrdu: { fontSize: 10, lineHeight: 26 },
  downloadText: { fontSize: 12, color: '#087443' },
  history: { marginTop: spacing[4], backgroundColor: '#FFFFFF', borderRadius: 20, padding: spacing[4], borderWidth: 1, borderColor: '#DFEAF8' },
  historyRow: { gap: spacing[2], borderTopWidth: 1, borderTopColor: '#EDF2FA', paddingVertical: spacing[3], alignItems: 'flex-start' },
  historyName: { flex: 1, minWidth: 0, fontSize: 13, color: '#172B4D' },
  historyDate: { fontSize: 11, color: '#687A95', maxWidth: '40%' },
  empty: { padding: spacing[4], borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8' },
});
