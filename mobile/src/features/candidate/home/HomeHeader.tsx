import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards } from '../../../lib/layoutDirection';

// Accent dot per Business Unit country (its flag's signature colour); any
// other country falls back to the brand blue.
const COUNTRY_DOT_COLORS: Record<string, string> = {
  qatar: '#8A1538',
  saudi_arabia: '#006C35',
  uae: '#00732F',
  oman: '#DB161B',
};

interface HomeHeaderProps {
  language: string;
  topInset: number;
  greeting: string;
  fullName: string;
  /** Already-formatted "Reference: DES-…" line, or the localized not-assigned text. */
  referenceLine: string;
  /** Absolute, validated photo URL -- null shows initials. */
  photoUri: string | null;
  photoLabel: string;
  country: { code: string; name: string } | null;
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** Gradient welcome header: greeting, name, reference, and the candidate's photo (or initials) above their Business Unit. */
export function HomeHeader({
  language,
  topInset,
  greeting,
  fullName,
  referenceLine,
  photoUri,
  photoLabel,
  country,
}: HomeHeaderProps) {
  const isUrdu = language === 'ur';
  // Explicit so a Latin-script name or reference still lines up with the
  // Urdu greeting on the right instead of following its own LTR default.
  const textAlignment = { textAlign: physicalTextAlign(isUrdu ? 'right' : 'left') };
  return (
    <View style={[styles.header, { paddingTop: topInset + 14 }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="homeHeader" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1599F4" />
            <Stop offset="0.46" stopColor="#096EE5" />
            <Stop offset="1" stopColor="#074CC2" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeHeader)" />
        <Circle cx="92%" cy="0%" r="90" fill="#FFFFFF" fillOpacity={0.09} />
        <Circle cx="62%" cy="112%" r="62" fill="#FFFFFF" fillOpacity={0.09} />
      </Svg>

      <View style={[styles.row, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]}>
        <View style={styles.identity}>
          <Text style={[styles.greeting, isUrdu && styles.greetingUrdu, textAlignment, { fontFamily: getFontFamily(language, 'medium') }]}>
            {greeting}
          </Text>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[styles.name, isUrdu && styles.nameUrdu, textAlignment, { fontFamily: getFontFamily(language, 'bold') }]}
          >
            {fullName}
          </Text>
          <Text style={[styles.reference, isUrdu && styles.referenceUrdu, textAlignment, { fontFamily: getFontFamily(language, 'regular') }]}>
            {referenceLine}
          </Text>
        </View>

        <View style={styles.avatarColumn}>
          <View style={styles.avatarRing} accessible accessibilityRole="image" accessibilityLabel={photoLabel}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.initials}>{initialsOf(fullName)}</Text>
            )}
          </View>
          {country ? (
            <View style={styles.countryRow}>
              <View style={[styles.countryDot, { backgroundColor: COUNTRY_DOT_COLORS[country.code] ?? colors.brand.default }]} />
              <Text style={[styles.countryName, { fontFamily: getFontFamily(language, 'bold') }]}>{country.name}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 58;

const styles = StyleSheet.create({
  header: {
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: '#096EE5',
  },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: spacing[4] },
  identity: { flex: 1 },
  greeting: { fontSize: 13, color: colors.text.inverse, opacity: 0.9 },
  greetingUrdu: { fontSize: 14, lineHeight: 28 },
  name: { marginTop: 2, fontSize: 22, lineHeight: 27, fontWeight: '800', color: colors.text.inverse },
  nameUrdu: { fontSize: 20, lineHeight: 38 },
  reference: { marginTop: spacing[1], fontSize: 13, color: colors.text.inverse, opacity: 0.9 },
  referenceUrdu: { lineHeight: 26 },
  avatarColumn: { alignItems: 'center', gap: spacing[1] },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.86)',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  initials: { fontSize: 20, fontWeight: '800', color: colors.text.inverse, fontFamily: getFontFamily('en', 'bold') },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  countryDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#FFFFFF' },
  countryName: { fontSize: 11, color: colors.text.inverse },
});
