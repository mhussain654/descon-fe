import { paymentEventSourceLabel, paymentEventTypeLabel } from './paymentLabels';

const t = (key: string) => `t:${key}`;

describe('paymentEventTypeLabel', () => {
  it('translates a known event_type', () => {
    expect(paymentEventTypeLabel('payment_succeeded', t)).toBe('t:adminFinancePaymentEventTypeSucceeded');
  });

  it('humanizes an unrecognized event_type instead of crashing or showing a raw key', () => {
    expect(paymentEventTypeLabel('provider_webhook_retried', t)).toBe('Provider Webhook Retried');
  });
});

describe('paymentEventSourceLabel', () => {
  it('translates a known event_source', () => {
    expect(paymentEventSourceLabel('callback', t)).toBe('t:adminFinancePaymentEventSourceCallback');
  });

  it('humanizes an unrecognized event_source', () => {
    expect(paymentEventSourceLabel('manual_reconciliation', t)).toBe('Manual Reconciliation');
  });
});
