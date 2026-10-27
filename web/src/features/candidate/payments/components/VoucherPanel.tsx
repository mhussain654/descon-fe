import { useState } from "react";
import { Copy } from "lucide-react";
import { Button, ValidationMessage } from "../../../../design-system";
import { PAYMENT_ERROR_KEYS } from "../../../../../../shared/payments/errorMessages";
import { isCheckoutExpired } from "../../../../../../shared/payments/statusLabels";
import type { Payment, PaymentError } from "../../../../../../shared/payments/types";
import type { Language, TranslationKey } from "../../../../../../shared/i18n/translations";

interface VoucherPanelProps {
  /** The code waiting to be paid, if any. */
  openVoucher: Payment | null;
  /** The newest payment, to tell "expired" apart from "never had a code". */
  latestPayment: Payment | null;
  voucherAvailable: boolean;
  /** A card checkout is open too: the candidate is told to pay one way only. */
  cardCheckoutOpen: boolean;
  isGettingCode: boolean;
  error: PaymentError | null;
  onGetCode: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  language: Language;
  t: (key: TranslationKey) => string;
}

/** The "pay with a code" tab: get the code, then pay it from a wallet or bank app. Never shows "paid" itself -- only the backend's status does. */
export function VoucherPanel(props: VoucherPanelProps) {
  const { openVoucher, latestPayment, voucherAvailable, cardCheckoutOpen, isGettingCode, error, onGetCode, onRefresh, isRefreshing, language, t } = props;

  if (openVoucher) {
    return <OpenVoucher voucher={openVoucher} onRefresh={onRefresh} isRefreshing={isRefreshing} language={language} t={t} />;
  }

  const wasExpired = latestPayment?.provider === "kuickpay_voucher" && isCheckoutExpired(latestPayment.status, latestPayment.checkoutExpiresAt);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">{t("paymentVoucherIntro")}</p>
      {wasExpired ? <ValidationMessage tone="error">{t("paymentVoucherExpiredMessage")}</ValidationMessage> : null}
      {cardCheckoutOpen ? <p className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{t("paymentCodeWhileCardOpenNotice")}</p> : null}
      {!voucherAvailable ? <ValidationMessage tone="error">{t("paymentVoucherUnavailableError")}</ValidationMessage> : null}
      {voucherAvailable ? (
        <Button onClick={onGetCode} disabled={isGettingCode} loading={isGettingCode}>
          {t(wasExpired ? "paymentVoucherGetNewCodeAction" : "paymentVoucherGetCodeAction")}
        </Button>
      ) : null}
      {error && error.code !== "IDEMPOTENCY_CONFLICT" ? (
        <ValidationMessage tone="error">{error.message || t(PAYMENT_ERROR_KEYS[error.code] as TranslationKey)}</ValidationMessage>
      ) : null}
    </div>
  );
}

function OpenVoucher({ voucher, onRefresh, isRefreshing, language, t }: { voucher: Payment; onRefresh: () => void; isRefreshing: boolean; language: Language; t: (key: TranslationKey) => string }) {
  const [copied, setCopied] = useState(false);
  const code = voucher.voucherNumber ?? "";
  const payBefore = voucher.checkoutExpiresAt ? new Date(voucher.checkoutExpiresAt).toLocaleDateString(language === "ur" ? "ur-PK" : "en-GB") : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 text-sm text-gray-600">{t("paymentVoucherCodeLabel")}</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="select-all text-2xl font-semibold tracking-wider text-black" dir="ltr">
            {code}
          </div>
          <Button variant="outline" size="sm" onClick={copy} leadingIcon={<Copy size={16} aria-hidden="true" />}>
            {t("paymentVoucherCopyAction")}
          </Button>
        </div>
        <div role="status" className="mt-1 h-4 text-xs text-green-700">
          {copied ? t("paymentVoucherCopiedMessage") : ""}
        </div>
        {payBefore ? (
          <div className="mt-2 text-sm text-gray-700">
            {t("paymentVoucherPayBeforeLabel")}: <span dir="ltr">{payBefore}</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 text-sm font-medium text-black">{t("paymentVoucherHowToTitle")}</div>
        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <div className="font-medium text-black">{t("paymentVoucherWayPhoneTitle")}</div>
            <p>{t("paymentVoucherWayPhoneBody")}</p>
          </div>
          <div>
            <div className="font-medium text-black">{t("paymentVoucherWayShopTitle")}</div>
            <p>{t("paymentVoucherWayShopBody")}</p>
          </div>
          <p className="font-medium text-black">{t("paymentVoucherPaySoon")}</p>
        </div>
      </div>

      <div className="rounded-xl bg-[#FFF7E6] px-4 py-3">
        <p className="mb-2 text-sm text-gray-700">{t("paymentVoucherWaiting")}</p>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
          {t("paymentManualRefreshAction")}
        </Button>
      </div>
      <p className="rounded-xl bg-[#FFF7E6] px-4 py-3 text-sm text-gray-700">{t("paymentPayOnlyOneNotice")}</p>
    </div>
  );
}
