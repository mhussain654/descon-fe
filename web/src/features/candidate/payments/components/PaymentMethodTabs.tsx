import type { PaymentMethod } from "../../../../../../shared/payments/types";
import type { TranslationKey } from "../../../../../../shared/i18n/translations";

const TAB_LABEL_KEYS: Record<PaymentMethod, TranslationKey> = {
  voucher: "paymentTabVoucher",
  card: "paymentTabCard",
};

interface PaymentMethodTabsProps {
  methods: PaymentMethod[];
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  label: string;
  t: (key: TranslationKey) => string;
}

/** The "pay with a code" / "pay by card" tabs. Shown only when more than one way is offered. */
export function PaymentMethodTabs({ methods, selected, onSelect, label, t }: PaymentMethodTabsProps) {
  if (methods.length < 2) return null;

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {methods.map((method) => (
        <button
          key={method}
          type="button"
          role="tab"
          id={`payment-tab-${method}`}
          aria-selected={selected === method}
          aria-controls={`payment-panel-${method}`}
          onClick={() => onSelect(method)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            selected === method ? "bg-white text-black shadow-sm" : "text-gray-600"
          }`}
        >
          {t(TAB_LABEL_KEYS[method])}
        </button>
      ))}
    </div>
  );
}
