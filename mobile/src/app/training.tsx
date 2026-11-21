import { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Text } from '../design-system/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, GraduationCap, Play } from 'lucide-react-native';
import { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MeasuredSvg } from '../design-system/MeasuredSvg';
import { spacing } from '../design-system/tokens';
import { isStartSide, physicalTextAlign, rowDirectionTowards } from '../lib/layoutDirection';
import { RequireAuth } from '../features/auth/RequireAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTrainingVideos } from '../features/candidate/training/hooks/useTrainingVideos';
import { getFontFamily } from '../design-system';
import { TrainingVideoPlayer } from '../features/candidate/training/components/TrainingVideoPlayer';
import type { TrainingVideo } from '../lib/training-videos-client';
import { themed, themedStyles } from '../design-system/theme';

export default function TrainingRoute() {
  return <RequireAuth><TrainingScreen /></RequireAuth>;
}

function TrainingScreen() {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const query = useTrainingVideos();
  const [selected, setSelected] = useState<TrainingVideo | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const isUrdu = language === 'ur';
  const font = getFontFamily(language, 'regular');
  const semibold = getFontFamily(language, 'semibold');
  const textAlign = physicalTextAlign(isUrdu ? 'right' : 'left');
  const BackArrow = isUrdu ? ArrowRight : ArrowLeft;
  async function openVideo(video: TrainingVideo) {
    setOpeningId(video.id);
    try {
      const refreshed = await query.refetch();
      const current = refreshed.data?.find(item => item.id === video.id);
      if (current?.playback_url) setSelected(current);
    } finally {
      setOpeningId(null);
    }
  }
  return <View style={styles.screen}>
    <StatusBar style="light" />
    {/* Same gradient header as Documents, My Journey and Profile, with a back arrow since Training opens from Home. */}
    <View style={[styles.hero, { paddingTop: insets.top + spacing[2] }]}>
      <MeasuredSvg>
        <Defs><LinearGradient id="trainingHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#2B8CD4" /><Stop offset="0.5" stopColor="#0065B3" /><Stop offset="1" stopColor="#004C87" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#trainingHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke={themed('#FFFFFF', '#1E293B')} strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </MeasuredSvg>
      <Pressable accessibilityRole="button" accessibilityLabel={t('trainingBack')} onPress={() => selected ? setSelected(null) : router.back()} style={[styles.back, { alignSelf: isStartSide(isUrdu ? 'right' : 'left') ? 'flex-start' : 'flex-end' }]}>
        <BackArrow color="#fff" size={23} />
      </Pressable>
      <View style={[styles.heroRow, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]}>
        <View style={styles.heroText}>
          <Text accessibilityRole="header" style={[styles.heroTitle, { fontFamily: getFontFamily(language, 'bold'), textAlign, lineHeight: isUrdu ? 50 : 34 }]}>{t('homeQuickTrainingTitle')}</Text>
          <Text style={[styles.heroSubtitle, { fontFamily: font, textAlign, lineHeight: isUrdu ? 30 : 21 }]}>{t('trainingIntro')}</Text>
        </View>
        <View style={styles.heroIcon} accessible={false}><GraduationCap size={29} color={themed('#0065B3', '#8FCEFF')} /></View>
      </View>
    </View>
    {selected ? <View style={[styles.sheet, styles.playerContainer]}>
      <Text style={[styles.title, { fontFamily: semibold, textAlign }]}>{isUrdu ? selected.title_ur : selected.title_en}</Text>
      <TrainingVideoPlayer key={selected.id} url={selected.playback_url} language={language} errorMessage={t('trainingPlayError')} />
      <Pressable style={[styles.close, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]} onPress={() => setSelected(null)} accessibilityRole="button"><BackArrow size={18} color={themed('#0871DF', '#7FBBFA')} /><Text style={[styles.closeLabel, { fontFamily: semibold }]}>{t('trainingAllVideos')}</Text></Pressable>
    </View> : <ScrollView style={styles.sheet} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}>
      {query.isPending && <Text style={[styles.message, { fontFamily: font }]}>{t('loading')}</Text>}
      {query.isError && <Pressable onPress={() => query.refetch()} accessibilityRole="button"><Text style={[styles.message, { fontFamily: font }]}>{t('trainingLoadError')} {t('retry')}</Text></Pressable>}
      {query.data?.length === 0 && <Text style={[styles.message, { fontFamily: font }]}>{t('trainingEmpty')}</Text>}
      {query.data?.map(video => <Pressable key={video.id} style={styles.card} onPress={() => openVideo(video)} disabled={openingId !== null} accessibilityRole="button" accessibilityLabel={isUrdu ? video.title_ur : video.title_en}>
        <View style={styles.icon}><Play size={23} color={themed("#0871DF", "#7FBBFA")} /></View>
        <View style={styles.cardText}><Text style={[styles.title, { fontFamily: semibold, lineHeight: isUrdu ? 34 : 24 }]}>{isUrdu ? video.title_ur : video.title_en}</Text>
          {!!(isUrdu ? video.description_ur : video.description_en) && <Text style={[styles.description, { fontFamily: font, lineHeight: isUrdu ? 30 : 21 }]}>{isUrdu ? video.description_ur : video.description_en}</Text>}
        </View>
      </Pressable>)}
    </ScrollView>}
  </View>;
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: themed('#F5F8FD', '#0F172A') },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0065B3' },
  back: { width: 48, height: 40, justifyContent: 'center' },
  heroRow: { alignItems: 'center', gap: spacing[3] },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 25 },
  heroSubtitle: { color: '#E5F4FF', fontSize: 13, marginTop: spacing[1] },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: themed('#EAFBFF', '#122A30'), alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  sheet: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: themed('#F5F8FD', '#0F172A') },
  list: { padding: 20, gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: themed('#fff', '#1E293B'), borderRadius: 18, padding: 18, gap: 14, minHeight: 92, elevation: 2 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: themed('#EAF3FF', '#142234'), alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 }, title: { fontSize: 17, color: themed('#1A3150', '#AAC3E3') },
  description: { color: themed('#69778C', '#94A3B8'), fontSize: 13, marginTop: 4 },
  message: { color: themed('#435674', '#F1F5F9'), fontSize: 15, padding: 20 },
  playerContainer: { flex: 1, padding: 16, gap: 16 },
  close: { minHeight: 48, alignItems: 'center', gap: 8 },
  closeLabel: { color: themed('#0871DF', '#7FBBFA'), fontSize: 15 },
}));
