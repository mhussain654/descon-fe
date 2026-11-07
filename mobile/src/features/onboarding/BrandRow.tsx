import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../../design-system/Text';
import { getFontFamily } from '../../design-system';
import { colors, elevation, radii, spacing } from '../../design-system/tokens';
import { rowDirectionTowards } from '../../lib/layoutDirection';
import { themedStyles } from '../../design-system/theme';

const DESCON_LOGO = require('../../../assets/images/descon-logo.png');

interface BrandRowProps {
  /** Which script renders the product name ('ur' sets it in Nastaliq). */
  language: string;
  /** Already-translated product name parts, e.g. "MPS" + "Connect". */
  primary: string;
  secondary: string;
  /** The physical side the logo starts from: left for English, right for Urdu. */
  side: 'left' | 'right';
}

/**
 * The client's header for the language and sign-in pages: the official Descon
 * logo on a white tile (its blue wordmark would vanish on the blue sky) with
 * the product name on the same line, starting from the reading side.
 */
export function BrandRow({ language, primary, secondary, side }: BrandRowProps) {
  const isUrdu = language === 'ur';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${primary} ${secondary}`}
      style={[styles.row, { flexDirection: rowDirectionTowards(side) }]}
    >
      <View style={styles.tile}>
        <Image source={DESCON_LOGO} style={styles.logo} contentFit="contain" />
      </View>
      {isUrdu ? (
        // Nastaliq slopes along a line, so each word is its own element on one baseline.
        <View style={[styles.urduName, { flexDirection: rowDirectionTowards('right') }]}>
          <Text numberOfLines={1} style={[styles.name, styles.nameUrdu, { fontFamily: getFontFamily('ur', 'bold') }]}>{primary}</Text>
          <Text numberOfLines={1} style={[styles.name, styles.nameUrdu, { fontFamily: getFontFamily('ur', 'regular') }]}>{secondary}</Text>
        </View>
      ) : (
        <Text numberOfLines={1} style={styles.name}>
          <Text style={{ fontFamily: getFontFamily('en', 'bold') }}>{primary}</Text>
          <Text style={{ fontFamily: getFontFamily('en', 'regular') }}>{` ${secondary}`}</Text>
        </Text>
      )}
    </View>
  );
}

export const BRAND_ROW_HEIGHT = 48;

const styles = themedStyles(() => ({
  row: { alignItems: 'center', gap: spacing[3] },
  tile: {
    width: BRAND_ROW_HEIGHT,
    height: BRAND_ROW_HEIGHT,
    borderRadius: radii.lg,
    // Brand book: the Descon logo always sits on white, in the dark theme too.
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  logo: { width: 40, height: 38 },
  name: { fontSize: 22, lineHeight: 28, color: colors.text.inverse },
  // Nastaliq needs the extra line height or its lower strokes clip.
  urduName: { alignItems: 'center', gap: spacing[1.5] },
  nameUrdu: { fontSize: 19, lineHeight: 42, writingDirection: 'rtl', paddingHorizontal: 2 },
}));
