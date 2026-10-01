import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getFontFamily } from '../../design-system';
import { colors, elevation, radii, spacing } from '../../design-system/tokens';

const DESCON_LOGO = require('../../../assets/images/descon-logo.png');

interface BrandHeaderProps {
  language: string;
  /** Already-translated product name parts, e.g. "DESCON" + "MPS". */
  primary: string;
  secondary: string;
  /** Whether the logo tile sits at the row's start (else the row reverses). */
  tileAtRowStart: boolean;
}

/**
 * The official Descon logo on a white tile (its blue wordmark would vanish on
 * a blue hero), followed by the localized product name. The logo itself is
 * never mirrored -- it is the company's brand mark -- only its position moves.
 */
export function BrandHeader({ language, primary, secondary, tileAtRowStart }: BrandHeaderProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${primary} ${secondary}`}
      style={[styles.row, tileAtRowStart ? null : styles.rowReversed]}
    >
      <View style={styles.tile}>
        <Image source={DESCON_LOGO} style={styles.logo} contentFit="contain" />
      </View>
      <Text style={[styles.name, language === 'ur' ? styles.nameUrdu : null]}>
        <Text style={{ fontFamily: getFontFamily(language, 'bold') }}>{primary}</Text>
        <Text style={{ fontFamily: getFontFamily(language, 'regular') }}>{` ${secondary}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rowReversed: { flexDirection: 'row-reverse' },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface.raised,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  logo: { width: 31, height: 30 },
  name: { fontSize: 22, lineHeight: 28, color: colors.text.inverse, letterSpacing: 0.5 },
  nameUrdu: { fontSize: 19, lineHeight: 38, letterSpacing: 0 },
});
