import { View } from 'react-native';
import { Text } from '../../../../design-system/Text';
import { BadgeCheck, BriefcaseBusiness, Camera, CheckCircle, Clock, FileCheck, FileText, IdCard, Landmark, Upload, XCircle } from 'lucide-react-native';
import { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MeasuredSvg } from '../../../../design-system/MeasuredSvg';
import type { CandidateDocumentChecklistItem } from '../../../../../../shared/candidateDocuments/types';
import { DOCUMENT_STATUS_GROUP_KEYS, type DocumentStatusGroup, type DocumentSummaryTile } from '../../../../../../shared/candidateDocuments/statusGroups';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from '../../home/GradientIconBox';
import { themed, themedStyles, themedValues } from '../../../../design-system/theme';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };

function copyStyle(language: Language) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const };
}

export function DocumentsHeader({ language, t, topInset }: LocaleProps & { topInset: number }) {
  const rtl = language === 'ur';
  return (
    <View style={[documentsStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <MeasuredSvg>
        <Defs><LinearGradient id="documentsHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2B8CD4" /><Stop offset="0.5" stopColor="#0065B3" /><Stop offset="1" stopColor="#004C87" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#documentsHero)" />
        <Circle cx="95%" cy="85%" r="84" stroke={themed("#FFFFFF", "#1E293B")} strokeOpacity={0.1} strokeWidth={24} fill="none" />
      </MeasuredSvg>
      <View style={[documentsStyles.heroCopy, { flexDirection: rowDirectionTowards(rtl ? 'right' : 'left') }]}>
        <View style={documentsStyles.flexCopy}>
          <Text accessibilityRole="header" style={[documentsStyles.heroTitle, copyStyle(language), { fontFamily: getFontFamily(language, 'bold') }, rtl && documentsStyles.heroTitleUrdu]}>{t('documents')}</Text>
          <Text style={[documentsStyles.heroSubtitle, copyStyle(language), rtl && documentsStyles.urduBody]}>{t('candidateDocumentsSubtitle')}</Text>
        </View>
        <View style={documentsStyles.heroIcon} accessible={false}><FileText size={30} color={themed("#0065B3", "#8FCEFF")} strokeWidth={2} /></View>
      </View>
    </View>
  );
}

const TILE_LOOKS: Record<DocumentStatusGroup, { tone: IconTone; icon: typeof FileText; bg: string; color: string }> = themedValues(() => ({
  approved: { tone: 'green', icon: CheckCircle, bg: themed('#E9FAF1', '#133121'), color: themed('#087C46', '#82F7C1') },
  uploaded: { tone: 'purple', icon: FileCheck, bg: themed('#F3EEFF', '#1E1436'), color: themed('#6941C6', '#BBA9E5') },
  required: { tone: 'blue', icon: Upload, bg: themed('#E9F3FF', '#142335'), color: themed('#0862BC', '#93C7FA') },
  under_approval: { tone: 'orange', icon: Clock, bg: themed('#FFF5E6', '#312513'), color: themed('#9A5700', '#FFC57A') },
  rejected: { tone: 'coral', icon: XCircle, bg: themed('#FDECEC', '#361515'), color: themed('#B42318', '#F2A29C') },
}));

/** Three cards: Approved, Uploaded, Required before the documents are submitted; Approved, Under Approval, Rejected after. */
export function DocumentsSummary({ language, t, tiles }: LocaleProps & { tiles: readonly DocumentSummaryTile[] }) {
  return (
    <View style={[documentsStyles.summary, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      {tiles.map(({ group, count }) => ({ group, count, ...TILE_LOOKS[group] })).map(tile => (
        <View key={tile.group} testID={`documents-summary-${tile.group}`} style={[documentsStyles.stat, { backgroundColor: tile.bg }]}>
          <GradientIconBox tone={tile.tone} icon={tile.icon} size={26} />
          <Text style={[documentsStyles.statNumber, { color: tile.color, fontFamily: getFontFamily(language, 'bold') }]}>{tile.count}</Text>
          <Text numberOfLines={2} style={[documentsStyles.statLabel, { color: tile.color, fontFamily: getFontFamily(language) }, language === 'ur' && documentsStyles.urduBody]}>{t(DOCUMENT_STATUS_GROUP_KEYS[tile.group])}</Text>
        </View>
      ))}
    </View>
  );
}

const DOCUMENT_ICONS: Record<string, { icon: typeof FileText; tone: IconTone }> = {
  passport: { icon: FileText, tone: 'blue' },
  cnic: { icon: IdCard, tone: 'purple' },
  photograph: { icon: Camera, tone: 'coral' },
  next_of_kin_cnic: { icon: IdCard, tone: 'orange' },
  cv: { icon: BriefcaseBusiness, tone: 'blue' },
  educational_certificates: { icon: BadgeCheck, tone: 'purple' },
  experience_certificates: { icon: BriefcaseBusiness, tone: 'green' },
  cheque_copy: { icon: Landmark, tone: 'orange' },
};

export function DocumentCardHeading({ item, statusLine, statusColor, language, t }: { item: CandidateDocumentChecklistItem; statusLine: string; statusColor: string; language: Language; t: LocaleProps['t'] }) {
  const { icon, tone } = DOCUMENT_ICONS[item.requirementCode] ?? { icon: FileText, tone: 'blue' as const };
  return (
    <View style={[documentsStyles.rowContent, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      <GradientIconBox tone={tone} icon={icon} size={40} />
      <View style={documentsStyles.flexCopy}>
        <Text style={[documentsStyles.documentTitle, copyStyle(language), { fontFamily: getFontFamily(language, 'semibold') }, language === 'ur' && documentsStyles.urduBody]}>{item.requirementCode === 'photograph' ? t('candidateDocumentsPhotoName') : item.name}</Text>
        <Text style={[documentsStyles.documentStatus, copyStyle(language), { color: statusColor }, language === 'ur' && documentsStyles.urduBody]}>{statusLine}</Text>
        {item.document?.rejectionReason ? <Text style={[documentsStyles.rejection, copyStyle(language), language === 'ur' && documentsStyles.urduBody]}>{item.document.rejectionReason}</Text> : null}
      </View>
    </View>
  );
}

export const documentsStyles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: themed('#F0F7FF', '#0F172A') },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0065B3' },
  heroCopy: { alignItems: 'center', gap: spacing[3], marginTop: 0 },
  heroTitle: { fontSize: 25, lineHeight: 32, color: '#FFFFFF' },
  heroTitleUrdu: { lineHeight: 44 },
  heroSubtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[1] },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: themed('#EAFBFF', '#122A30'), alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: themed('#F0F7FF', '#0F172A') },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  summary: { gap: spacing[2], marginBottom: spacing[5] },
  stat: { flex: 1, minWidth: 0, borderRadius: 18, padding: spacing[2], alignItems: 'center', gap: spacing[1] },
  statNumber: { fontSize: 24, lineHeight: 30 },
  statLabel: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
  card: { borderRadius: 20, padding: spacing[4], marginBottom: spacing[3], borderWidth: 1, ...elevation.sm },
  cardRow: { alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  rowContent: { alignItems: 'center', gap: spacing[3] },
  flexCopy: { flex: 1, minWidth: 0 },
  documentTitle: { fontSize: 15, lineHeight: 23, color: themed('#172B4D', '#A9BFE5'), marginBottom: spacing[1] },
  documentStatus: { fontSize: 12, lineHeight: 19 },
  rejection: { fontSize: 12, lineHeight: 20, color: themed('#B42318', '#F2A29C'), marginTop: spacing[1] },
  urduBody: { lineHeight: 30 },
  sectionHeading: { fontSize: 16, lineHeight: 24, color: themed('#172B4D', '#A9BFE5'), marginBottom: spacing[3] },
  quickAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  actionHint: { fontSize: 12, lineHeight: 20, color: themed('#0862BC', '#93C7FA'), marginTop: spacing[2] },
}));
