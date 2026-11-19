import { View } from 'react-native';
import { Text } from '../../design-system/Text';
import { getFontFamily } from '../../design-system';
import { spacing } from '../../design-system/tokens';
import { themedStyles } from '../../design-system/theme';

// Descon brand red and navy. The banner sits on the hero artwork, which is the
// same in both themes, so these stay fixed rather than following the theme.
const DESCON_RED = '#E31E24';
const BANNER_NAVY = '#0B2D6B';

interface TaglineBannerProps {
  /** Already-translated tagline. */
  text: string;
  /** 'ur' sets it in Nastaliq (no slant); anything else in Inter. */
  language: string;
  /** The physical side the banner hangs from: left for English, right for Urdu. */
  side: 'left' | 'right';
}

/**
 * The Welcome page tagline as a banner (client-approved "Option A", Nov 2026):
 * a white card tilted slightly upward, with a slanted Descon-red band behind
 * it that shows above and below its edges. Mirrors for Urdu.
 */
export function TaglineBanner({ text, language, side }: TaglineBannerProps) {
  const isUrdu = language === 'ur';
  const fromLeft = side === 'left';

  return (
    <View testID="tagline-banner" style={[styles.banner, fromLeft ? styles.fromLeft : styles.fromRight]}>
      <View style={[styles.redBand, fromLeft ? styles.redBandLeft : styles.redBandRight]} />
      <View style={styles.card}>
        <Text
          style={[
            styles.text,
            isUrdu ? styles.textUrdu : styles.textSlanted,
            { fontFamily: getFontFamily(language, 'bold'), writingDirection: isUrdu ? 'rtl' : 'ltr' },
          ]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  banner: { marginTop: spacing[4] },
  // Starts a little past the heading's edge and tilts up toward the reading direction.
  fromLeft: { alignSelf: 'flex-start', marginLeft: -10, transform: [{ rotate: '-3deg' }] },
  fromRight: { alignSelf: 'flex-end', marginRight: -10, transform: [{ rotate: '3deg' }] },
  redBand: { position: 'absolute', top: -5, bottom: -5, borderRadius: 12, backgroundColor: DESCON_RED },
  redBandLeft: { left: 22, right: -4, transform: [{ rotate: '-1.5deg' }, { skewX: '-14deg' }] },
  redBandRight: { right: 22, left: -4, transform: [{ rotate: '1.5deg' }, { skewX: '14deg' }] },
  card: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#001E5A',
    shadowOpacity: 0.3,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // The width cap breaks the English tagline into two even lines:
  // "Your Gateway to" / "Overseas Employment".
  text: { maxWidth: 210, textAlign: 'center', color: BANNER_NAVY, fontSize: 17, lineHeight: 21 },
  // Inter has no italic face loaded, so a slight skew gives the banner's slant on every platform.
  textSlanted: { transform: [{ skewX: '-10deg' }] },
  // Nastaliq needs about twice the line height, and is never slanted.
  textUrdu: { maxWidth: 240, fontSize: 16, lineHeight: 34 },
}));
