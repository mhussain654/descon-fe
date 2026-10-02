import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreditCard, FileText, Hourglass } from 'lucide-react-native';
import { Button, getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from './GradientIconBox';
import { homeCardStyles } from './homeCardStyles';

export type NextStepVariant = 'payment' | 'documents' | 'waiting';

const VARIANTS: Record<NextStepVariant, { tone: IconTone; icon: typeof CreditCard; background: string; border: string }> = {
  payment: { tone: 'orange', icon: CreditCard, background: '#FFF6E4', border: '#FFD77E' },
  documents: { tone: 'blue', icon: FileText, background: '#EAF5FF', border: '#BFE2FF' },
  waiting: { tone: 'green', icon: Hourglass, background: '#ECF9F1', border: '#BDEBCD' },
};

interface NextStepCardProps {
  language: string;
  variant: NextStepVariant;
  /** Small label above the title, e.g. "Next step". */
  eyebrow: string;
  title: string;
  description: string;
  /** Payment only: the backend-configured fee, already formatted. */
  amountText?: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** The candidate's single most relevant next step -- paying the fee, fixing documents, or (when it's on staff) what to expect next. */
export function NextStepCard({
  language,
  variant,
  eyebrow,
  title,
  description,
  amountText,
  actionLabel,
  onAction,
  actionDisabled,
  leadingIcon,
  trailingIcon,
}: NextStepCardProps) {
  const isUrdu = language === 'ur';
  const config = VARIANTS[variant];
  const rowDirection = rowDirectionTowards(isUrdu ? 'right' : 'left');
  return (
    <View
      style={[homeCardStyles.card, styles.card, { backgroundColor: config.background, borderColor: config.border }]}
    >
      <View style={[styles.row, { flexDirection: rowDirection }]}>
        <GradientIconBox tone={config.tone} icon={config.icon} size={38} />
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, isUrdu && styles.eyebrowUrdu, { fontFamily: getFontFamily(language, 'semibold') }]}>
            {eyebrow}
          </Text>
          <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
            {title}
          </Text>
          <Text
            style={[styles.description, isUrdu && styles.descriptionUrdu, { fontFamily: getFontFamily(language, 'regular') }]}
          >
            {description}
          </Text>
        </View>
      </View>

      <View style={[styles.actionRow, { flexDirection: rowDirection }, amountText ? null : styles.actionRowEnd]}>
        {amountText ? <Text style={styles.amount}>{amountText}</Text> : null}
        <Button
          variant="primary"
          size="sm"
          language={isUrdu ? 'ur' : 'en'}
          onPress={onAction}
          disabled={actionDisabled}
          leadingIcon={leadingIcon}
          trailingIcon={trailingIcon}
          style={styles.button}
          labelStyle={isUrdu ? styles.buttonLabelUrdu : styles.buttonLabel}
        >
          {actionLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { alignItems: 'center', gap: spacing[3] },
  copy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: '#4F5D72', textTransform: 'uppercase' },
  eyebrowUrdu: { fontSize: 11, letterSpacing: 0, lineHeight: 20, textTransform: 'none' },
  title: { marginTop: 1, fontSize: 15, lineHeight: 19, fontWeight: '800', color: colors.text.primary },
  titleUrdu: { fontSize: 14, lineHeight: 28 },
  description: { marginTop: 2, fontSize: 11.5, lineHeight: 15, color: '#4F5D72' },
  descriptionUrdu: { fontSize: 11, lineHeight: 22 },
  actionRow: { marginTop: 10, alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  actionRowEnd: { justifyContent: 'flex-end' },
  amount: { flexShrink: 1, fontSize: 22, fontWeight: '800', color: colors.text.primary, fontFamily: getFontFamily('en', 'bold') },
  button: { height: 36, paddingHorizontal: 16, borderRadius: 10 },
  buttonLabel: { fontSize: 13 },
  buttonLabelUrdu: { fontSize: 13 },
});
