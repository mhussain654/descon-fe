import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, Play, X } from 'lucide-react-native';
import WebView from 'react-native-webview';
import { RequireAuth } from '../features/auth/RequireAuth';
import { useLanguage } from '../contexts/LanguageContext';
import { useTrainingVideos } from '../features/candidate/training/hooks/useTrainingVideos';
import { getFontFamily } from '../design-system';
import type { TrainingVideo } from '../lib/training-videos-client';

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('trainingBack')} onPress={() => selected ? setSelected(null) : router.back()} style={styles.back}>
        {isUrdu ? <ArrowRight color="#fff" size={23} /> : <ArrowLeft color="#fff" size={23} />}
      </Pressable>
      <Text style={[styles.heroTitle, { fontFamily: font, lineHeight: isUrdu ? 44 : 32 }]}>{t('homeQuickTrainingTitle')}</Text>
      <Text style={[styles.heroSubtitle, { fontFamily: font, lineHeight: isUrdu ? 31 : 21 }]}>{t('trainingIntro')}</Text>
    </View>
    {selected ? <View style={styles.playerContainer}>
      <Text style={[styles.title, { fontFamily: font }]}>{isUrdu ? selected.title_ur : selected.title_en}</Text>
      <WebView
        originWhitelist={['https://*']}
        source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000"><video src="${escapeHtmlAttribute(selected.playback_url)}" controls playsinline style="width:100%;height:100%;object-fit:contain"></video></body></html>` }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        javaScriptEnabled={false}
        style={styles.player}
      />
      <Pressable style={styles.close} onPress={() => setSelected(null)} accessibilityRole="button"><X size={18} color={'#0871DF'} /><Text style={{ fontFamily: font }}>{t('trainingAllVideos')}</Text></Pressable>
    </View> : <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}>
      {query.isPending && <Text style={[styles.message, { fontFamily: font }]}>{t('loading')}</Text>}
      {query.isError && <Pressable onPress={() => query.refetch()} accessibilityRole="button"><Text style={[styles.message, { fontFamily: font }]}>{t('trainingLoadError')} {t('retry')}</Text></Pressable>}
      {query.data?.length === 0 && <Text style={[styles.message, { fontFamily: font }]}>{t('trainingEmpty')}</Text>}
      {query.data?.map(video => <Pressable key={video.id} style={styles.card} onPress={() => openVideo(video)} disabled={openingId !== null} accessibilityRole="button" accessibilityLabel={isUrdu ? video.title_ur : video.title_en}>
        <View style={styles.icon}><Play size={23} color="#0871DF" /></View>
        <View style={styles.cardText}><Text style={[styles.title, { fontFamily: font, lineHeight: isUrdu ? 34 : 24 }]}>{isUrdu ? video.title_ur : video.title_en}</Text>
          {!!(isUrdu ? video.description_ur : video.description_en) && <Text style={[styles.description, { fontFamily: font, lineHeight: isUrdu ? 30 : 21 }]}>{isUrdu ? video.description_ur : video.description_en}</Text>}
        </View>
      </Pressable>)}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FD' },
  hero: { backgroundColor: '#164984', paddingHorizontal: 22, paddingBottom: 25, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  back: { width: 48, height: 48, justifyContent: 'center', marginBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 24 },
  heroSubtitle: { color: '#DCE9FA', fontSize: 14, marginTop: 4 },
  list: { padding: 20, gap: 14 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 14, minHeight: 92, elevation: 2 },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 }, title: { fontSize: 17, color: '#1A3150', fontWeight: '600' },
  description: { color: '#69778C', fontSize: 13, marginTop: 4 },
  message: { color: '#435674', fontSize: 15, padding: 20 },
  playerContainer: { flex: 1, padding: 16, gap: 16 }, player: { height: 260, backgroundColor: '#000', flex: 0 },
  close: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
