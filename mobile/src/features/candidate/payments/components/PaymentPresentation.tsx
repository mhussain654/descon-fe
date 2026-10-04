import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, Ban, CheckCircle, Clock, CreditCard, Info, Wallet, XCircle } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Payment } from '../../../../../../shared/payments/types';
import { PAYMENT_STATUS_KEYS, PAYMENT_STATUS_TONES } from '../../../../../../shared/payments/statusLabels';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { Badge, getFontFamily } from '../../../../design-system';
import { elevation, spacing } from '../../../../design-system/tokens';
import { physicalTextAlign, rowDirectionTowards } from '../../../../lib/layoutDirection';
import { GradientIconBox, type IconTone } from '../../home/GradientIconBox';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };
const STATUS_ICONS = { checkout_pending: Clock, paid: CheckCircle, failed: XCircle, cancelled: Ban, expired: XCircle, unknown: Info };
const STATUS_TONES: Record<keyof typeof STATUS_ICONS, IconTone> = { checkout_pending: 'orange', paid: 'green', failed: 'coral', cancelled: 'purple', expired: 'coral', unknown: 'blue' };

export function paymentCopyStyle(language: Language) {
  return { fontFamily: getFontFamily(language), textAlign: physicalTextAlign(language === 'ur' ? 'right' : 'left'), writingDirection: language === 'ur' ? 'rtl' as const : 'ltr' as const, ...(language === 'ur' ? { lineHeight: 30 } : {}) };
}

export function PaymentHeader({ language, t, topInset, onBack }: LocaleProps & { topInset: number; onBack: () => void }) {
  const BackIcon = language === 'ur' ? ArrowRight : ArrowLeft;
  return (
    <View style={[paymentStyles.hero, { paddingTop: topInset + spacing[3] }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false} pointerEvents="none">
        <Defs><LinearGradient id="paymentHero" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#16A5EE" /><Stop offset="0.5" stopColor="#0873DF" /><Stop offset="1" stopColor="#0649B9" /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill="url(#paymentHero)" />
        <Circle cx="96%" cy="90%" r="78" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={22} fill="none" />
      </Svg>
      <View style={[paymentStyles.heading, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={8} style={({ pressed }) => [paymentStyles.back, pressed && paymentStyles.pressed]}>
          <BackIcon size={20} color="#FFFFFF" />
        </Pressable>
        <Text accessibilityRole="header" style={[paymentStyles.title, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('makePayment')}</Text>
        <View style={paymentStyles.heroIcon} accessible={false}><CreditCard size={26} color="#0873DF" /></View>
      </View>
      <Text style={[paymentStyles.subtitle, paymentCopyStyle(language)]}>{t('makePaymentDesc')}</Text>
    </View>
  );
}

export function PaymentAmountCard({ amount, currencyCode, language, t }: LocaleProps & { amount: string; currencyCode: string }) {
  return (
    <View style={[paymentStyles.card, paymentStyles.amountCard]}>
      <View style={[paymentStyles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <GradientIconBox icon={Wallet} tone="purple" size={40} />
        <View style={paymentStyles.flex}>
          <Text style={[paymentStyles.label, paymentCopyStyle(language)]}>{t('paymentAmountLabel')}</Text>
          <Text style={[paymentStyles.amount, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{amount} {currencyCode}</Text>
        </View>
      </View>
    </View>
  );
}

export function LatestPaymentCard({ payment, expired, language, t }: LocaleProps & { payment: Payment; expired: boolean }) {
  const status = expired ? 'expired' : payment.status;
  const tone = expired ? 'danger' : PAYMENT_STATUS_TONES[payment.status];
  const label = expired ? 'paymentStatusExpired' : PAYMENT_STATUS_KEYS[payment.status] as TranslationKey;
  return (
    <View style={paymentStyles.card}>
      <View style={[paymentStyles.receiptHeading, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <Text style={[paymentStyles.sectionTitle, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'bold') }]}>{t('paymentLatestPaymentLabel')}</Text>
        <View style={paymentStyles.badge}><Badge tone={tone} language={language}>{t(label)}</Badge></View>
      </View>
      <View style={[paymentStyles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <GradientIconBox icon={STATUS_ICONS[status]} tone={STATUS_TONES[status]} size={36} />
        <Text style={[paymentStyles.receiptAmount, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'semibold') }]}>{payment.amount} {payment.currencyCode}</Text>
      </View>
      {status === 'paid' && payment.paidAt ? <Text style={[paymentStyles.receiptDetail, paymentCopyStyle(language)]}>{t('paymentPaidAtLabel')}: {new Date(payment.paidAt).toLocaleString(language === 'ur' ? 'ur-PK' : 'en-GB')}</Text> : null}
      {status === 'paid' ? <Text selectable style={[paymentStyles.receiptDetail, paymentCopyStyle(language)]}>{t('paymentReferenceLabel')}: {payment.id}</Text> : null}
    </View>
  );
}

export function PaymentNotice({ title, message, language, children }: { title?: string; message: string; language: Language; children?: ReactNode }) {
  return (
    <View style={[paymentStyles.card, paymentStyles.notice]}>
      <View style={[paymentStyles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
        <GradientIconBox icon={Info} tone="orange" size={32} />
        <View style={paymentStyles.flex}>
          {title ? <Text style={[paymentStyles.noticeTitle, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'semibold') }]}>{title}</Text> : null}
          <Text accessibilityLiveRegion="polite" style={[paymentStyles.noticeText, paymentCopyStyle(language)]}>{message}</Text>
        </View>
      </View>
      {children ? <View style={paymentStyles.noticeAction}>{children}</View> : null}
    </View>
  );
}

export const paymentStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F7FF' },
  hero: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], overflow: 'hidden', backgroundColor: '#0873DF' },
  heading: { alignItems: 'center', gap: spacing[3] },
  title: { flex: 1, minWidth: 0, fontSize: 25, lineHeight: 34, color: '#FFFFFF' },
  subtitle: { fontSize: 13, lineHeight: 21, color: '#E5F4FF', marginTop: spacing[2] },
  heroIcon: { width: 44, height: 44, flexShrink: 0, borderRadius: 14, backgroundColor: '#EAFBFF', alignItems: 'center', justifyContent: 'center' },
  back: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFFFFF24', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  scroll: { flex: 1, marginTop: -20, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#F0F7FF' },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[4], width: '100%', maxWidth: 600, alignSelf: 'center' },
  card: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFEAF8', padding: spacing[4], marginBottom: spacing[4], ...elevation.sm },
  amountCard: { backgroundColor: '#F9FCFF', paddingVertical: spacing[5] },
  row: { alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: 12, lineHeight: 20, color: '#687A95' },
  amount: { fontSize: 27, lineHeight: 38, color: '#172B4D', marginTop: spacing[1] },
  receiptHeading: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  sectionTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 23, color: '#172B4D' },
  badge: { flexShrink: 0, maxWidth: '50%' },
  receiptAmount: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 27, color: '#172B4D' },
  receiptDetail: { fontSize: 12, lineHeight: 21, color: '#536780', marginTop: spacing[3] },
  notice: { backgroundColor: '#FFF8EA', borderColor: '#F3DEB4' },
  noticeTitle: { fontSize: 14, lineHeight: 23, color: '#6F430B', marginBottom: spacing[1] },
  noticeText: { fontSize: 13, lineHeight: 22, color: '#6F430B' },
  noticeAction: { marginTop: spacing[3] },
  pay: { height: 34, borderRadius: 10, backgroundColor: '#0873DF' },
  error: { marginTop: spacing[3], marginBottom: spacing[4] },
});
