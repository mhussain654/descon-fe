import { Pressable, View } from 'react-native';
import { Text } from '../../../design-system/Text';
import { Check } from 'lucide-react-native';
import { getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { homeCardStyles } from './homeCardStyles';
import { themed, themedStyles } from '../../../design-system/theme';

interface LatestUpdateCardProps {
  language: string;
  heading: string;
  seeAllLabel: string;
  onSeeAll: () => void;
  /** Null renders the empty message instead. */
  update: { title: string; description: string; dateLabel: string | null } | null;
  emptyMessage: string;
}

/** The single most recent step in the candidate's application, with a link to the full history on Status. */
export function LatestUpdateCard({ language, heading, seeAllLabel, onSeeAll, update, emptyMessage }: LatestUpdateCardProps) {
  const isUrdu = language === 'ur';
  const rowDirection = rowDirectionTowards(isUrdu ? 'right' : 'left');
  return (
    <View>
      <View style={[styles.headingRow, { flexDirection: rowDirection }]}>
        <Text style={[styles.heading, isUrdu && styles.headingUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
          {heading}
        </Text>
        <Pressable onPress={onSeeAll} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.seeAll, { fontFamily: getFontFamily(language, 'bold') }]}>{seeAllLabel}</Text>
        </Pressable>
      </View>

      <View style={[homeCardStyles.card, styles.card, { flexDirection: rowDirection }]}>
        {update ? (
          <>
            <View style={styles.check}>
              <Check size={20} color={themed("#0B9D4B", "#83F6B6")} strokeWidth={3} />
            </View>
            <View style={styles.divider} />
            <View style={styles.copy}>
              <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'semibold') }]}>
                {update.title}
              </Text>
              <Text style={[styles.description, isUrdu && styles.descriptionUrdu, { fontFamily: getFontFamily(language, 'regular') }]}>
                {update.description}
              </Text>
              {update.dateLabel ? (
                <Text style={[styles.date, { fontFamily: getFontFamily(language, 'regular') }]}>{update.dateLabel}</Text>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={[styles.description, styles.empty, isUrdu && styles.descriptionUrdu, { fontFamily: getFontFamily(language, 'regular') }]}>
            {emptyMessage}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  headingRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2], paddingHorizontal: 2 },
  heading: { fontSize: 16, color: colors.text.primary },
  headingUrdu: { lineHeight: 34 },
  seeAll: { fontSize: 13, color: themed('#0871DB', '#7FBCFA') },
  card: { alignItems: 'center', gap: spacing[3], padding: 12 },
  divider: { width: 1, alignSelf: 'stretch', marginVertical: 4, backgroundColor: themed('#E5EAF2', '#334155') },
  check: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: themed('#DBF8E5', '#143620') },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  titleUrdu: { lineHeight: 30 },
  description: { marginTop: 2, fontSize: 12, lineHeight: 17, color: themed('#66738A', '#94A3B8') },
  descriptionUrdu: { lineHeight: 26 },
  date: { marginTop: 4, fontSize: 11, color: colors.text.tertiary },
  empty: { flex: 1, marginTop: 0 },
}));
