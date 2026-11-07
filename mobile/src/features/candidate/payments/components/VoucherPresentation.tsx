import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '../../../../design-system/Text';
import { Banknote, Copy } from 'lucide-react-native';
import type { Payment, PaymentMethod } from '../../../../../../shared/payments/types';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import { Button, getFontFamily } from '../../../../design-system';
import { spacing } from '../../../../design-system/tokens';
import { rowDirectionTowards } from '../../../../lib/layoutDirection';
import { GradientIconBox } from '../../home/GradientIconBox';
import { paymentCopyStyle, paymentStyles } from './PaymentPresentation';
import { themed, themedStyles } from '../../../../design-system/theme';

type LocaleProps = { language: Language; t: (key: TranslationKey) => string };

const TAB_LABEL_KEYS: Record<PaymentMethod, TranslationKey> = { voucher: 'paymentTabVoucher', card: 'paymentTabCard' };

/** The "pay with a code" / "pay by card" tabs. Shown only when more than one way is offered; the candidate may switch at any time. */
export function PaymentMethodTabs({ methods, selected, onSelect, language, t }: LocaleProps & { methods: PaymentMethod[]; selected: PaymentMethod; onSelect: (method: PaymentMethod) => void }) {
  if (methods.length < 2) return null;

  return (
    <View accessibilityRole="tablist" accessibilityLabel={t('paymentMethodTabsLabel')} style={[voucherStyles.tabs, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
      {methods.map((method) => (
        <Pressable
          key={method}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === method }}
          onPress={() => onSelect(method)}
          style={[voucherStyles.tab, selected === method && voucherStyles.tabSelected]}
        >
          <Text style={[voucherStyles.tabText, paymentCopyStyle(language), { textAlign: 'center', fontFamily: getFontFamily(language, 'semibold') }]}>{t(TAB_LABEL_KEYS[method])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** The payment code to pay from a wallet or bank app, with a Copy button, the two ways to pay it (phone or shop), and the date to pay before. */
export function VoucherCodeCard({ voucher, language, t }: LocaleProps & { voucher: Payment }) {
  const [copied, setCopied] = useState(false);
  const payBefore = voucher.checkoutExpiresAt ? new Date(voucher.checkoutExpiresAt).toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB') : null;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(voucher.voucherNumber ?? '');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <View style={paymentStyles.card}>
        <View style={[paymentStyles.row, { flexDirection: rowDirectionTowards(language === 'ur' ? 'right' : 'left') }]}>
          <GradientIconBox icon={Banknote} tone="green" size={40} />
          <View style={paymentStyles.flex}>
            <Text style={[paymentStyles.label, paymentCopyStyle(language)]}>{t('paymentVoucherCodeLabel')}</Text>
            <Text selectable accessibilityLabel={`${t('paymentVoucherCodeLabel')} ${voucher.voucherNumber ?? ''}`} style={[voucherStyles.code, { fontFamily: getFontFamily('en', 'bold'), writingDirection: 'ltr', textAlign: language === 'ur' ? 'right' : 'left' }]}>{voucher.voucherNumber}</Text>
          </View>
        </View>
        <View style={voucherStyles.copyRow}>
          <Button variant="outline" size="sm" onPress={copy} leadingIcon={<Copy size={16} color={themed("#172B4D", "#A9BFE5")} />} language={language}>
            {t('paymentVoucherCopyAction')}
          </Button>
        </View>
        <Text accessibilityLiveRegion="polite" style={[voucherStyles.copied, paymentCopyStyle(language)]}>{copied ? t('paymentVoucherCopiedMessage') : ''}</Text>
        {payBefore ? <Text style={[paymentStyles.receiptDetail, paymentCopyStyle(language)]}>{t('paymentVoucherPayBeforeLabel')}: {payBefore}</Text> : null}
      </View>

      <View style={paymentStyles.card}>
        <Text style={[paymentStyles.sectionTitle, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'bold'), marginBottom: spacing[3] }]}>{t('paymentVoucherHowToTitle')}</Text>
        {([['paymentVoucherWayPhoneTitle', 'paymentVoucherWayPhoneBody'], ['paymentVoucherWayShopTitle', 'paymentVoucherWayShopBody']] as const).map(([titleKey, bodyKey]) => (
          <View key={titleKey} style={voucherStyles.way}>
            <Text style={[voucherStyles.wayTitle, paymentCopyStyle(language), { fontFamily: getFontFamily(language, 'semibold') }]}>{t(titleKey)}</Text>
            <Text style={[paymentStyles.noticeText, paymentCopyStyle(language), { color: themed('#172B4D', '#A9BFE5') }]}>{t(bodyKey)}</Text>
          </View>
        ))}
        <Text style={[paymentStyles.noticeText, paymentCopyStyle(language), { color: themed('#172B4D', '#A9BFE5'), fontFamily: getFontFamily(language, 'semibold') }]}>{t('paymentVoucherPaySoon')}</Text>
      </View>
    </>
  );
}

const voucherStyles = themedStyles(() => ({
  tabs: { gap: spacing[1], padding: spacing[1], marginBottom: spacing[4], borderRadius: 14, backgroundColor: themed('#E4EEFA', '#152539') },
  tab: { flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: 11 },
  tabSelected: { backgroundColor: themed('#FFFFFF', '#1E293B') },
  tabText: { fontSize: 13, lineHeight: 20, color: themed('#172B4D', '#A9BFE5') },
  code: { fontSize: 26, lineHeight: 36, letterSpacing: 1, color: themed('#172B4D', '#A9BFE5'), marginTop: spacing[1] },
  copyRow: { marginTop: spacing[3], alignSelf: 'flex-start' },
  copied: { minHeight: 20, fontSize: 12, lineHeight: 20, color: themed('#1C7A45', '#93E6B7'), marginTop: spacing[1] },
  way: { marginBottom: spacing[3] },
  wayTitle: { fontSize: 14, lineHeight: 22, color: themed('#172B4D', '#A9BFE5'), marginBottom: spacing[1] },
}));
