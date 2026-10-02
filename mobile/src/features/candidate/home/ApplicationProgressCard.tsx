import { StyleSheet, Text, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { homeCardStyles } from './homeCardStyles';

interface ApplicationProgressCardProps {
  language: string;
  title: string;
  /** Localized current-stage name, shown as a highlighted status badge. */
  stageLabel: string | null;
  stepsLine: string;
  percentLine: string;
  percentage: number;
}

/** "My Journey": the current stage as a prominent badge plus overall step progress. */
export function ApplicationProgressCard({
  language,
  title,
  stageLabel,
  stepsLine,
  percentLine,
  percentage,
}: ApplicationProgressCardProps) {
  const isUrdu = language === 'ur';
  const rowDirection = rowDirectionTowards(isUrdu ? 'right' : 'left');
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <View style={[homeCardStyles.card, styles.card]}>
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        <View style={[styles.titleGroup, { flexDirection: rowDirection }]}>
          <View style={styles.iconBox} accessible={false}>
            <ClipboardList size={22} color="#1E6FE8" strokeWidth={2.2} />
          </View>
          <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
            {title}
          </Text>
        </View>
        {stageLabel ? (
          <View style={styles.badge}>
            <Text style={[styles.badgeText, isUrdu && styles.badgeTextUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
              {stageLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.row, styles.metaRow, { flexDirection: rowDirection }]}>
        <Text style={[styles.meta, isUrdu && styles.metaUrdu, { fontFamily: getFontFamily(language, 'semibold') }]}>
          {stepsLine}
        </Text>
        <Text style={[styles.percent, isUrdu && styles.metaUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
          {percentLine}
        </Text>
      </View>

      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
      >
        <View style={[styles.fill, { width: `${clamped}%` }]}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="progressFill" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#0969EE" />
                <Stop offset="1" stopColor="#19C8E8" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#progressFill)" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderTopWidth: 4, borderTopColor: '#19C6E8' },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  titleGroup: { flex: 1, alignItems: 'center', gap: spacing[3] },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FF' },
  title: { flexShrink: 1, fontSize: 18, fontWeight: '800', color: colors.text.primary },
  titleUrdu: { fontSize: 17, lineHeight: 34 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FFF1D8' },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#C36A00' },
  badgeTextUrdu: { lineHeight: 24 },
  metaRow: { marginTop: spacing[3] },
  meta: { flexShrink: 1, fontSize: 13, color: colors.text.primary },
  percent: { fontSize: 13, color: '#0871DA' },
  metaUrdu: { lineHeight: 26 },
  track: { height: 8, marginTop: spacing[2], borderRadius: 999, overflow: 'hidden', backgroundColor: '#E9EEF5' },
  fill: { height: '100%', borderRadius: 999, overflow: 'hidden' },
});
