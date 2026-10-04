import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck, BriefcaseBusiness, Check, FileText, Globe, LogOut, Plane, ShieldCheck, UserRound } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { TranslationKey } from '../../../../../shared/i18n/translations';
import { Button, getFontFamily, ValidationMessage } from '../../../design-system';
import { colors, elevation, spacing } from '../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards, isStartSide } from '../../../lib/layoutDirection';
import { BrandHeader } from '../../onboarding/BrandHeader';
import { forwardArrowSlots } from '../../onboarding/directionalArrows';
import { GradientIconBox } from '../home/GradientIconBox';

interface ConsentContentProps {
  language: 'en' | 'ur';
  t: (key: TranslationKey) => string;
  topInset: number;
  bottomInset: number;
  isPending: boolean;
  isError: boolean;
  onAccept: () => void;
  onLogout: () => void;
  onToggleLanguage: () => void;
}

const SECTIONS = [
  { title: 'consentInformationTitle', body: 'consentInformationStatement', icon: UserRound, tone: 'blue' },
  { title: 'consentUseTitle', body: 'consentUseStatement', icon: Globe, tone: 'purple' },
  { title: 'consentConfirmationTitle', body: 'consentConfirmationStatement', icon: BadgeCheck, tone: 'green' },
] as const;

/** Presents the complete consent statement; the route owns authentication and the API mutation. */
export function ConsentContent({ language, t, topInset, bottomInset, isPending, isError, onAccept, onLogout, onToggleLanguage }: ConsentContentProps) {
  const [checked, setChecked] = useState(false);
  const isUrdu = language === 'ur';
  const rowStyle = { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') };
  const textStyle = { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(isUrdu ? 'right' : 'left'), writingDirection: isUrdu ? 'rtl' as const : 'ltr' as const };
  const headingStyle = { ...textStyle, fontFamily: getFontFamily(language, 'bold') };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing[5] }]}>
      <View style={[styles.hero, { paddingTop: topInset + spacing[3] }]}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none" accessible={false}>
          <Defs><LinearGradient id="consentHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#16A5EE" /><Stop offset="0.48" stopColor="#0873DF" /><Stop offset="1" stopColor="#0649B9" /></LinearGradient></Defs>
          <Rect width="100%" height="100%" fill="url(#consentHero)" />
          <Circle cx="100%" cy="45%" r="115" fill="none" stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={30} />
        </Svg>
        <View style={[styles.topRow, rowStyle]}>
          <BrandHeader language={language} primary={t('brandNamePrimary')} secondary={t('brandNameSecondary')} tileAtRowStart={isStartSide(isUrdu ? 'right' : 'left')} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('consentSwitchLanguage')} disabled={isPending} onPress={onToggleLanguage} style={styles.language}>
            <Text style={[styles.languageText, { fontFamily: getFontFamily(isUrdu ? 'en' : 'ur', 'medium') }]}>{isUrdu ? 'English' : 'اردو'}</Text>
          </Pressable>
        </View>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.orbit} />
          <View style={styles.shield}><ShieldCheck size={38} color={colors.brand.default} strokeWidth={2.1} /></View>
          <View style={styles.document}><GradientIconBox tone="purple" icon={FileText} size={32} /></View>
          <View style={styles.plane}><GradientIconBox tone="orange" icon={Plane} size={32} /></View>
          <View style={styles.briefcase}><GradientIconBox tone="coral" icon={BriefcaseBusiness} size={32} /></View>
          <View style={styles.tick}><Check size={14} color={colors.success.on} strokeWidth={3} /></View>
        </View>
        <Text accessibilityRole="header" style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>{t('consentJourneyTitle')}</Text>
        <Text style={[styles.intro, isUrdu && styles.introUrdu, { fontFamily: getFontFamily(language) }]}>{t('consentJourneyMessage')}</Text>
      </View>
      <View style={styles.sheet}>
        <View style={[styles.kickerRow, rowStyle]}>
          <Text accessibilityRole="header" style={[styles.kicker, headingStyle]}>{t('consentStatementTitle')}</Text>
        </View>
        <View style={styles.policy}>
          {SECTIONS.map(({ title, body, icon, tone }) => (
            <View key={body} style={[styles.section, rowStyle]}>
              <GradientIconBox tone={tone} icon={icon} size={32} />
              <View style={styles.sectionCopy}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, headingStyle, isUrdu && styles.sectionTitleUrdu]}>{t(title)}</Text>
                <Text style={[styles.statement, textStyle, isUrdu && styles.statementUrdu]}>{t(body)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={t('consentCheckboxLabel')} accessibilityState={{ checked, disabled: isPending }} disabled={isPending} onPress={() => setChecked(value => !value)} style={[styles.choice, checked && styles.choiceChecked, rowStyle]}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Check size={16} color={colors.brand.on} strokeWidth={3} /> : null}</View>
          <Text style={[styles.choiceText, textStyle, { fontFamily: getFontFamily(language, 'medium') }, isUrdu && styles.statementUrdu]}>{t('consentCheckboxLabel')}</Text>
        </Pressable>
        {isError ? <ValidationMessage tone="error">{t('consentErrorMessage')}</ValidationMessage> : null}
        <Button fullWidth size="lg" language={language} disabled={!checked} loading={isPending} onPress={() => { if (checked && !isPending) onAccept(); }} style={styles.accept} labelStyle={[styles.acceptText, isUrdu && styles.acceptUrdu]} {...forwardArrowSlots(language, colors.brand.on)}>{t('consentAcceptAction')}</Button>
        <Button fullWidth variant="text" language={language} disabled={isPending} onPress={onLogout} leadingIcon={<LogOut size={16} color={colors.text.secondary} />} labelStyle={styles.logoutText}>{t('consentDeclineAction')}</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, backgroundColor: '#F0F7FF' },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0873DF' },
  topRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], flexWrap: 'wrap' },
  language: { minHeight: 44, minWidth: 62, paddingHorizontal: spacing[3], borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  languageText: { color: colors.text.inverse, fontSize: 12, lineHeight: 28 },
  art: { width: 176, height: 106, marginTop: spacing[3], marginBottom: spacing[1], alignSelf: 'center' },
  orbit: { position: 'absolute', left: 42, top: 3, width: 93, height: 93, borderRadius: 47, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  shield: { position: 'absolute', left: 55, top: 16, width: 68, height: 68, borderRadius: 20, backgroundColor: '#EAFBFF', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], ...elevation.lg },
  document: { position: 'absolute', left: 10, top: 14, transform: [{ rotate: '-10deg' }] },
  plane: { position: 'absolute', right: 6, top: 10, transform: [{ rotate: '12deg' }] },
  briefcase: { position: 'absolute', left: 21, bottom: 6, transform: [{ rotate: '9deg' }] },
  tick: { position: 'absolute', right: 27, bottom: 4, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#157BE0', backgroundColor: colors.success.default, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: 25, lineHeight: 32, color: colors.text.inverse },
  titleUrdu: { fontSize: 23, lineHeight: 46 },
  intro: { textAlign: 'center', marginTop: spacing[2], fontSize: 14, lineHeight: 22, color: '#E5F4FF' },
  introUrdu: { lineHeight: 32 },
  sheet: { marginTop: -24, padding: spacing[4], gap: spacing[4], borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F0F7FF', width: '100%', maxWidth: 600, alignSelf: 'center' },
  kickerRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], flexWrap: 'wrap' },
  kicker: { fontSize: 12, color: colors.text.primary },
  policy: { backgroundColor: colors.surface.raised, padding: spacing[4], borderRadius: 20, gap: spacing[5], ...elevation.sm },
  section: { alignItems: 'flex-start', gap: spacing[3] },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 14, lineHeight: 22, marginBottom: spacing[1], color: colors.text.primary },
  sectionTitleUrdu: { lineHeight: 32 },
  statement: { fontSize: 14, lineHeight: 23, color: '#55667E' },
  statementUrdu: { lineHeight: 34 },
  choice: { padding: spacing[3], minHeight: 56, alignItems: 'center', gap: spacing[3], backgroundColor: colors.surface.raised, borderWidth: 1, borderColor: colors.border.default, borderRadius: 16 },
  choiceChecked: { borderColor: colors.brand.default, backgroundColor: colors.brand.subtle },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border.strong, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brand.default, borderColor: colors.brand.default },
  choiceText: { flex: 1, fontSize: 13, lineHeight: 22, color: colors.text.primary },
  accept: { height: undefined, minHeight: 56, paddingVertical: spacing[3], borderRadius: 16, ...elevation.md },
  acceptText: { flexShrink: 1, fontSize: 16 },
  acceptUrdu: { fontSize: 15, lineHeight: 32 },
  logoutText: { color: colors.text.secondary, flexShrink: 1 },
});
