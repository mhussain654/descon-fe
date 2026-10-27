import { StyleSheet, View } from 'react-native';
import { Text } from '../../design-system/Text';
import { Image } from 'expo-image';
import { getFontFamily } from '../../design-system';
import { colors, elevation, radii, spacing } from '../../design-system/tokens';
import { rowDirectionTowards } from '../../lib/layoutDirection';

const DESCON_LOGO = require('../../../assets/images/descon-logo.png');

interface BrandHeaderProps {
  language: string;
  /** Already-translated product name parts, e.g. "MPS" + "Connect" ("ایم پی ایس" + "کنیکٹ" in Urdu). */
  primary: string;
  secondary: string;
}

/**
 * The agreed brand lockup (MoM 30-09-26): the official Descon logo on a white
 * tile -- its blue wordmark would vanish on a blue hero, and the brand guide
 * wants it whole on white with clear space -- with the product name centred
 * below it. The name follows the active language (Urdu script in Urdu); the
 * logo itself is never mirrored.
 */
export function BrandHeader({ language, primary, secondary }: BrandHeaderProps) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${primary} ${secondary}`} style={styles.column}>
      <View style={styles.tile}>
        <Image source={DESCON_LOGO} style={styles.logo} contentFit="contain" />
      </View>
      {language === 'ur' ? (
        // Nastaliq slopes down along a line, so a whole-name run looks uneven under a level logo.
        // Each word is its own element in one row instead, so both sit on the same baseline.
        <View style={[styles.nameRow, { flexDirection: rowDirectionTowards('right') }]}>
          <Text numberOfLines={1} style={[styles.name, styles.nameUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
            {primary}
          </Text>
          <Text numberOfLines={1} style={[styles.name, styles.nameUrdu, styles.nameUrduSecond, { fontFamily: getFontFamily(language, 'regular') }]}>
            {secondary}
          </Text>
        </View>
      ) : (
        <Text numberOfLines={1} style={styles.name}>
          <Text style={{ fontFamily: getFontFamily(language, 'bold') }}>{primary}</Text>
          <Text style={{ fontFamily: getFontFamily(language, 'regular') }}>{` ${secondary}`}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: spacing[1] },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  logo: { width: 52, height: 50 },
  name: { fontSize: 18, lineHeight: 26, color: colors.text.inverse, letterSpacing: 0 },
  // Nastaliq needs the extra line height or its lower strokes clip.
  nameRow: { alignItems: 'center', marginTop: -spacing[1] },
  // Small side padding (not the shared Urdu default) so the two words sit one word-space apart, as a single phrase.
  nameUrdu: { fontSize: 16, lineHeight: 41, writingDirection: 'rtl', paddingHorizontal: 3 },
  // "کنیکٹ" rides higher in its line box than "ایم پی ایس"; nudging it down levels the two words.
  nameUrduSecond: { marginTop: 13 },
});
