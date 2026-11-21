import { View } from 'react-native';
import { Text } from '../../../design-system/Text';
import { Image } from 'expo-image';
import { CloudSun, Moon, Sun } from 'lucide-react-native';
import { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MeasuredSvg } from '../../../design-system/MeasuredSvg';
import { getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards } from '../../../lib/layoutDirection';
import { interpolateSegments, type InterpolatedSegment } from '../../../../../shared/i18n/interpolate';
import { themedStyles } from '../../../design-system/theme';

// Accent dot per Business Unit country (its flag's signature colour); any
// other country falls back to the brand blue.
const COUNTRY_DOT_COLORS: Record<string, string> = {
  qatar: '#8A1538',
  saudi_arabia: '#006C35',
  uae: '#00732F',
  oman: '#DB161B',
};

export type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// A drawn icon rather than an emoji, so it looks the same on every phone.
// Simple shapes that stay readable at this size: the sun and moon are filled
// for the solid look of an emoji; the cloud-and-sun stays an outline.
const GREETING_ICONS = { morning: Sun, afternoon: CloudSun, evening: Moon } as const;
const GREETING_ICON_COLOR = '#FFD166';
const FILLED_GREETING_ICONS: ReadonlySet<TimeOfDay> = new Set(['morning', 'evening']);

interface HomeHeaderProps {
  language: string;
  topInset: number;
  /** Picks the icon beside the greeting: sunrise, sun or moon. */
  timeOfDay: TimeOfDay;
  greeting: string;
  fullName: string;
  /** "File No. %{reference}" split into label and value (see interpolateSegments), or the not-assigned text as one plain segment. */
  referenceLine: InterpolatedSegment[];
  /** "Craft: %{craft}" split into label and value, or null when no craft is known yet. */
  craftLine: InterpolatedSegment[] | null;
  /** Absolute, validated photo URL -- null shows initials. */
  photoUri: string | null;
  photoLabel: string;
  country: { code: string; name: string } | null;
  /** Translated "Application in Process for %{country}" sentence; the country name is filled in, in bold. */
  countryLineTemplate: string;
}

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** Gradient welcome header: greeting with a sun/cloud-and-sun/moon icon (by time of day), name, file number, craft, "Application in Process for <country>", and the candidate's photo (or initials). */
export function HomeHeader({
  language,
  topInset,
  timeOfDay,
  greeting,
  fullName,
  referenceLine,
  craftLine,
  photoUri,
  photoLabel,
  country,
  countryLineTemplate,
}: HomeHeaderProps) {
  const isUrdu = language === 'ur';
  const GreetingIcon = GREETING_ICONS[timeOfDay];
  // Explicit so a Latin-script name or reference still lines up with the
  // Urdu greeting on the right instead of following its own LTR default.
  const textAlignment = { textAlign: physicalTextAlign(isUrdu ? 'right' : 'left') };
  return (
    <View style={[styles.header, { paddingTop: topInset + 14 }]}>
      <MeasuredSvg>
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
      </MeasuredSvg>

      <View style={[styles.row, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]}>
        <View style={styles.identity}>
          <View style={[styles.greetingRow, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]}>
            <View testID={`home-greeting-icon-${timeOfDay}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <GreetingIcon size={19} color={GREETING_ICON_COLOR} fill={FILLED_GREETING_ICONS.has(timeOfDay) ? GREETING_ICON_COLOR : 'none'} strokeWidth={2.4} />
            </View>
            <Text style={[styles.greeting, isUrdu && styles.greetingUrdu, textAlignment, { fontFamily: getFontFamily(language, 'medium') }]}>
              {greeting}
            </Text>
          </View>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[styles.name, isUrdu && styles.nameUrdu, textAlignment, { fontFamily: getFontFamily(language, 'bold') }]}
          >
            {fullName}
          </Text>
          <LabeledValueLine segments={referenceLine} language={language} isUrdu={isUrdu} alignment={textAlignment} />
          {craftLine ? <LabeledValueLine segments={craftLine} language={language} isUrdu={isUrdu} alignment={textAlignment} /> : null}
        </View>

        <View style={styles.avatarColumn}>
          <View style={styles.avatarRing} accessible accessibilityRole="image" accessibilityLabel={photoLabel}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.initials}>{initialsOf(fullName)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Its own full-width row below the photo, so the sentence is not squeezed beside it and stays on one line. */}
      {country ? (
        <View style={[styles.countryRow, { flexDirection: rowDirectionTowards(isUrdu ? 'right' : 'left') }]}>
          <View style={[styles.countryDot, { backgroundColor: COUNTRY_DOT_COLORS[country.code] ?? colors.brand.default }]} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.countryName, isUrdu && styles.countryNameUrdu, textAlignment, { fontFamily: getFontFamily(language, 'semibold') }]}
          >
            {interpolateSegments(countryLineTemplate, { country: country.name }).map((segment, position) =>
              segment.slot === 'country' ? (
                <Text key={position} style={{ fontFamily: getFontFamily(language, 'bold') }}>{segment.text}</Text>
              ) : (
                segment.text
              )
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface LabeledValueLineProps {
  segments: InterpolatedSegment[];
  language: string;
  isUrdu: boolean;
  alignment: { textAlign: 'left' | 'right' };
}

/** A label and its value on one line ("File No. DES-100005"): the label quiet and dimmed, the value semibold in full white, wherever the language places it. */
function LabeledValueLine({ segments, language, isUrdu, alignment }: LabeledValueLineProps) {
  return (
    <Text style={[styles.reference, isUrdu && styles.referenceUrdu, alignment, { fontFamily: getFontFamily(language, 'regular') }]}>
      {segments.map((segment, position) =>
        segment.slot ? (
          <Text key={position} style={[styles.referenceValue, { fontFamily: getFontFamily(language, 'semibold') }]}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}

const AVATAR_SIZE = 58;

const styles = themedStyles(() => ({
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
  greetingRow: { alignItems: 'center', gap: 6 },
  greeting: { fontSize: 13, color: colors.text.inverse, opacity: 0.9 },
  greetingUrdu: { fontSize: 14, lineHeight: 28 },
  name: { marginTop: 2, fontSize: 22, lineHeight: 27, color: colors.text.inverse },
  nameUrdu: { fontSize: 20, lineHeight: 38 },
  // Labels are dimmed and values full white, so the values read at a glance without competing with the name.
  reference: { marginTop: spacing[1], fontSize: 13, color: 'rgba(255, 255, 255, 0.78)' },
  referenceValue: { color: colors.text.inverse },
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
  initials: { fontSize: 20, color: colors.text.inverse, fontFamily: getFontFamily('en', 'bold') },
  countryRow: { marginTop: spacing[2], alignItems: 'center', gap: spacing[2] },
  countryDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFFFFF' },
  countryName: { flexShrink: 1, fontSize: 13, color: colors.text.inverse },
  countryNameUrdu: { lineHeight: 26 },
}));
