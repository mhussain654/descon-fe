import { Card, Timeline, type TimelineItemData } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { paymentEventSourceLabel, paymentEventTypeLabel } from '../../../../../../shared/adminPayments/paymentLabels';
import { useLanguage } from '../../../../contexts/LanguageContext';
import type { PaymentEvent } from '../../../../lib/admin-payments-client';

export interface PaymentEventTimelineProps {
  events: PaymentEvent[];
}

/** The payment-event timeline (ticket: "Payment-event timeline") -- every entry is a real, already-occurred event, so every marker renders as 'completed' (Timeline's current/pending states describe in-progress multi-stage flows, which doesn't apply to a flat historical audit log). Never renders `payload`/raw callback data -- only what PaymentEventSerializer already exposes. */
export function PaymentEventTimeline({ events }: PaymentEventTimelineProps) {
  const { t, language } = useLanguage();

  const items: TimelineItemData[] = events.map((event) => ({
    id: event.id,
    label: paymentEventTypeLabel(event.eventType, t),
    description: [
      formatDate(event.occurredAt, language, { dateStyle: 'medium', timeStyle: 'short' }),
      paymentEventSourceLabel(event.eventSource, t),
      event.actor ? event.actor.role : null,
    ]
      .filter(Boolean)
      .join(' • '),
    status: 'completed',
  }));

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminFinancePaymentEventsTitle')}</h2>
      {events.length === 0 ? <p className="text-sm text-text-secondary">{t('adminFinancePaymentEventsEmpty')}</p> : <Timeline items={items} />}
    </Card>
  );
}
