import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../../../design-system/Text';
import { CreditCard, FileText } from 'lucide-react-native';
import { Button, getFontFamily } from '../../../design-system';
import { colors, spacing } from '../../../design-system/tokens';
import { rowDirectionTowards } from '../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from './GradientIconBox';
import { homeCardStyles } from './homeCardStyles';
import { themed, themedStyles, themedValues } from '../../../design-system/theme';

export type NextStepVariant = 'payment' | 'documents';

const VARIANTS: Record<NextStepVariant, { tone: IconTone; icon: typeof CreditCard; background: string; border: string }> = themedValues(() => ({
  payment: { tone: 'orange', icon: CreditCard, background: themed('#FFF6E4', '#312712'), border: themed('#FFD77E', '#334155') },
  documents: { tone: 'blue', icon: FileText, background: themed('#EAF5FF', '#132433'), border: themed('#BFE2FF', '#334155') },
}));

interface NextStepCardProps {
  language: string;
  variant: NextStepVariant;
  /** The small "Next step" label stacked above the title. */
  label: string;
  title: string;
  description?: string;
  /** Payment only: the backend-configured fee, already formatted. */
  amountText?: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** The candidate's one thing to do now -- paying the fee, or uploading documents. */
export function NextStepCard({
  language,
  variant,
  label,
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
          <Text style={[styles.label, isUrdu && styles.labelUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
            {isUrdu ? label : label.toUpperCase()}
          </Text>
          <Text style={[styles.title, isUrdu && styles.titleUrdu, { fontFamily: getFontFamily(language, 'bold') }]}>
            {title}
          </Text>
          {description ? (
            <Text
              style={[styles.description, isUrdu && styles.descriptionUrdu, { fontFamily: getFontFamily(language, 'regular') }]}
            >
              {description}
            </Text>
          ) : null}
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

const styles = themedStyles(() => ({
  card: { borderWidth: 1 },
  row: { alignItems: 'center', gap: spacing[3] },
  copy: { flex: 1 },
  label: { fontSize: 11, lineHeight: 15, letterSpacing: 0.8, color: colors.brand.default },
  // Nastaliq has no capitals and breaks apart with letter spacing.
  labelUrdu: { fontSize: 11, lineHeight: 22, letterSpacing: 0 },
  title: { fontSize: 17, lineHeight: 22, color: colors.text.primary },
  titleUrdu: { fontSize: 14, lineHeight: 28 },
  description: { marginTop: 2, fontSize: 11.5, lineHeight: 15, color: themed('#4F5D72', '#94A3B8') },
  descriptionUrdu: { fontSize: 11, lineHeight: 22 },
  actionRow: { marginTop: 10, alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  actionRowEnd: { justifyContent: 'flex-end' },
  amount: { flexShrink: 1, fontSize: 22, color: colors.text.primary, fontFamily: getFontFamily('en', 'bold') },
  button: { height: 36, paddingHorizontal: 16, borderRadius: 10 },
  buttonLabel: { fontSize: 13 },
  buttonLabelUrdu: { fontSize: 13 },
}));
