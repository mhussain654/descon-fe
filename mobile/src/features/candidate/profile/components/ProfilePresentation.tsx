import type { ComponentType } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, ChevronLeft, ChevronRight, FileText, Flag, Globe, IdCard, LogOut, MapPin } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { CandidateProfile } from '../../../../../../shared/candidateProfile/types';
import { candidateStatusLabel } from '../../../../../../shared/candidateProfile/formatting';
import type { ApplicationProgressDocuments } from '../../../../../../shared/applicationProgress/types';
import { APPLICATION_SUBMISSION_STATE_KEYS, APPLICATION_SUBMISSION_STATE_TONES } from '../../../../../../shared/applicationProgress/statusLabels';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { Button, getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';
import { GradientIconBox, type IconTone } from '../../home/GradientIconBox';
import { ProfilePhotoEditor } from './ProfilePhotoEditor';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };
const DOCUMENT_TONES: Record<string, IconTone> = { success: 'green', warning: 'orange', danger: 'coral', info: 'blue', neutral: 'purple' };
function copyStyle(language: Language) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const, ...(language === 'ur' ? { lineHeight: 30 } : {}) };
}

export function ProfileHeader({ language, t, topInset, profile }: LocaleProps & { topInset: number; profile?: CandidateProfile }) {
  const rtl = language === 'ur';
  const photoUri = profile?.photoUrl ? resolveDocumentAccessUrl(profile.photoUrl, process.env.EXPO_PUBLIC_API_BASE_URL ?? '') : null;
  return (
    <View style={[profileStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false} pointerEvents="none">
        <Defs><LinearGradient id="profileHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#16A5EE" /><Stop offset="0.5" stopColor="#0873DF" /><Stop offset="1" stopColor="#0649B9" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#profileHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </Svg>
      <View style={[profileStyles.heroRow, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
        <View style={profileStyles.flex}>
          <Text accessibilityRole="header" style={[profileStyles.title, copyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('profile')}</Text>
          <Text style={[profileStyles.subtitle, copyStyle(language)]}>{t('candidateProfileSubtitle')}</Text>
        </View>
        <View style={profileStyles.heroAvatar} accessible={false}>
          {photoUri ? <Image testID="profile-header-photo" source={{ uri: photoUri }} style={profileStyles.heroPhoto} contentFit="cover" /> : <Text style={[profileStyles.heroInitial, { fontFamily: getFontFamily(language, 'bold') }]}>{profile?.fullName?.trim().charAt(0).toUpperCase() || ''}</Text>}
        </View>
      </View>
    </View>
  );
}

function ProfileInfoRow({ icon, tone, label, value, language }: { icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; tone: IconTone; label: string; value: string; language: Language }) {
  return (
    <View style={[profileStyles.infoRow, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      <GradientIconBox icon={icon} tone={tone} size={34} />
      <View style={profileStyles.flex}>
        <Text style={[profileStyles.label, copyStyle(language)]}>{label}</Text>
        <Text style={[profileStyles.value, copyStyle(language), { fontFamily: getFontFamily(language, 'medium') }]}>{value}</Text>
      </View>
    </View>
  );
}

export function ProfileDetails({ profile, documents, language, t }: LocaleProps & { profile: CandidateProfile; documents?: ApplicationProgressDocuments }) {
  const unassigned = t('candidateProfileNotAssignedYet');
  return (
    <>
      <View style={[profileStyles.card, profileStyles.identity]}>
        <ProfilePhotoEditor language={language} t={t} fullName={profile.fullName} photoUri={profile.photoUrl ? resolveDocumentAccessUrl(profile.photoUrl, process.env.EXPO_PUBLIC_API_BASE_URL ?? '') || null : null} />
        <Text style={[profileStyles.name, copyStyle(language), { fontFamily: getFontFamily(language, 'bold'), textAlign: 'center' }]}>{profile.fullName}</Text>
      </View>
      <View style={profileStyles.card}>
        <Text accessibilityRole="header" style={[profileStyles.sectionTitle, copyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('personalInfo')}</Text>
        <ProfileInfoRow icon={IdCard} tone="purple" label={t('candidateProfileMaskedCnicLabel')} value={profile.maskedCnic} language={language} />
        <ProfileInfoRow icon={FileText} tone="blue" label={t('candidateProfileReferenceNumberLabel')} value={profile.referenceNumber ?? unassigned} language={language} />
      </View>
      <View style={profileStyles.card}>
        <Text accessibilityRole="header" style={[profileStyles.sectionTitle, copyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('candidateProfileAssignmentTitle')}</Text>
        <ProfileInfoRow icon={MapPin} tone="orange" label={t('candidateProfileBusinessUnitLabel')} value={profile.country?.name ?? unassigned} language={language} />
        <ProfileInfoRow icon={CheckCircle} tone="green" label={t('candidateProfileStatusLabel')} value={candidateStatusLabel(profile)} language={language} />
        <ProfileInfoRow icon={Flag} tone="blue" label={t('candidateProfileWorkflowStageLabel')} value={profile.currentWorkflowStage?.name ?? unassigned} language={language} />
        {documents ? <ProfileInfoRow icon={CheckCircle} tone={DOCUMENT_TONES[APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState]]} label={t('candidateProfileDocumentsSectionTitle')} value={t(APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState] as TranslationKey)} language={language} /> : null}
      </View>
    </>
  );
}

export function ProfileSettings({ language, t, onLanguageChange, onLogout }: LocaleProps & { onLanguageChange: () => void; onLogout: () => void }) {
  const rtl = language === 'ur';
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  return (
    <View style={profileStyles.card}>
      <Text accessibilityRole="header" style={[profileStyles.sectionTitle, copyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('candidateProfilePreferencesTitle')}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('language')} onPress={onLanguageChange} style={({ pressed }) => [profileStyles.languageRow, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }, pressed && profileStyles.pressed]}>
        <GradientIconBox icon={Globe} tone="purple" size={34} />
        <View style={profileStyles.flex}>
          <Text style={[profileStyles.value, copyStyle(language), { fontFamily: getFontFamily(language, 'medium') }]}>{t('language')}</Text>
          <Text style={[profileStyles.label, copyStyle(language)]}>{t(language === 'en' ? 'englishLabel' : 'urduLabel')}</Text>
        </View>
        <Chevron size={18} color="#687A95" />
      </Pressable>
      <Button variant="outline" size="sm" fullWidth style={profileStyles.logout} labelStyle={profileStyles.logoutText} onPress={onLogout} language={language} leadingIcon={<LogOut size={16} color="#B42318" />}>{t('logout')}</Button>
    </View>
  );
}

export const profileStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0873DF' },
  heroRow: { alignItems: 'center', gap: spacing[3], marginTop: 0 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, lineHeight: 34, color: '#FFFFFF' },
  subtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[1] },
  heroAvatar: { width: 52, height: 52, flexShrink: 0, borderRadius: 26, overflow: 'hidden', borderWidth: 2, borderColor: '#BFDDFB', backgroundColor: '#EAFBFF', alignItems: 'center', justifyContent: 'center' },
  heroPhoto: { width: '100%', height: '100%' },
  heroInitial: { fontSize: 23, color: '#0873DF' },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F0F7FF' },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8', padding: spacing[4], marginBottom: spacing[4], ...elevation.sm },
  identity: { alignItems: 'center', backgroundColor: '#F9FCFF' },
  name: { fontSize: 18, lineHeight: 26, color: '#172B4D', width: '100%' },
  sectionTitle: { fontSize: 15, lineHeight: 23, color: '#172B4D', marginBottom: spacing[1] },
  infoRow: { gap: spacing[3], alignItems: 'flex-start', paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: '#EDF2FA' },
  label: { fontSize: 11, lineHeight: 18, color: '#687A95' },
  value: { fontSize: 13, lineHeight: 21, color: '#172B4D', marginTop: 2 },
  languageRow: { gap: spacing[3], alignItems: 'center', paddingVertical: spacing[3], marginBottom: spacing[3], borderRadius: 12 },
  pressed: { backgroundColor: '#F0F7FF' },
  logout: { height: 34, borderRadius: 10, backgroundColor: '#FFF0EE', borderColor: '#F4C4BD' },
  logoutText: { fontSize: 12, color: '#B42318' },
});
