import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getFontFamily } from '../../../../design-system';

interface TrainingVideoPlayerProps {
  /** Short-lived signed URL of the MP4. */
  url: string;
  language: string;
  /** Already-translated message shown when the video cannot be played. */
  errorMessage: string;
}

/**
 * Native (ExoPlayer on Android, AVPlayer on iOS) player for a training video. It replaces a
 * WebView <video>, which gave candidates a silent black box on some Android devices and had no
 * way to report why playback failed; here a failure is surfaced as a visible message.
 */
export function TrainingVideoPlayer({ url, language, errorMessage }: TrainingVideoPlayerProps) {
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer({ uri: url }, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    setFailed(false);
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setFailed(true);
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} nativeControls allowsFullscreen contentFit="contain" />
      {failed ? (
        <View style={styles.error} accessible accessibilityRole="alert">
          <Text style={[styles.errorText, { fontFamily: getFontFamily(language, 'regular') }]}>{errorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  video: { flex: 1 },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#000' },
  errorText: { color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 26 },
});
