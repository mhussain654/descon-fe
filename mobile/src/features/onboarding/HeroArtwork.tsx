import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from 'react-native-svg';
import { HeroDarkFade } from './HeroDarkFade';

const HERO_ART = {
  en: require('../../../assets/images/welcome-hero.webp'),
  ur: require('../../../assets/images/welcome-hero-rtl.webp'),
};

// The artwork's top edge, sampled left to right from the English image (the
// Urdu image is its mirror). Filling the space above the artwork with it makes
// the sky look continuous.
const SKY_STOPS = ['#006AF1', '#006FF4', '#017FFB', '#129FFD', '#25A4FB'];
// The sky fill fades out over the artwork's first few points, so no seam shows.
const SEAM_BLEND = 36;

interface HeroArtworkProps {
  language: string;
  width: number;
  artTop: number;
  artHeight: number;
  /** Hidden until the copy above it has been measured, so it never jumps. */
  visible: boolean;
}

/** The onboarding hero's artwork at its natural size, `artTop` down from the top, with sky above it. */
export function HeroArtwork({ language, width, artTop, artHeight, visible }: HeroArtworkProps) {
  const isUrdu = language === 'ur';
  const stops = isUrdu ? [...SKY_STOPS].reverse() : SKY_STOPS;
  const skyHeight = artTop + SEAM_BLEND;
  const fadeStart = artTop / skyHeight;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, !visible && styles.hidden]}>
      <Image
        source={HERO_ART[isUrdu ? 'ur' : 'en']}
        style={{ position: 'absolute', left: 0, top: artTop, width, height: artHeight }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      {artTop > 0 ? (
        <Svg style={styles.sky} width={width} height={skyHeight}>
          <Defs>
            <LinearGradient id="heroSky" x1="0" y1="0" x2="1" y2="0">
              {stops.map((color, index) => (
                <Stop key={color} offset={index / (stops.length - 1)} stopColor={color} />
              ))}
            </LinearGradient>
            <LinearGradient id="heroSkyFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset={0} stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset={fadeStart} stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <Mask id="heroSkyMask">
              <Rect x="0" y="0" width={width} height={skyHeight} fill="url(#heroSkyFade)" />
            </Mask>
          </Defs>
          <Rect x="0" y="0" width={width} height={skyHeight} fill="url(#heroSky)" mask="url(#heroSkyMask)" />
        </Svg>
      ) : null}
      <HeroDarkFade />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  sky: { position: 'absolute', left: 0, top: 0 },
});
