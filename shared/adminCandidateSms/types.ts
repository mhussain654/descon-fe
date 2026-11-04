// Contract for sending a candidate an SMS by hand from the admin candidate page,
// mirroring descon-be's openapi.yaml:
//   GET  /api/v1/admin/candidates/{candidate_id}/sms_messages
//   POST /api/v1/admin/candidates/{candidate_id}/sms_messages
import type { Language } from '../i18n/translations';

export type SmsLocale = Language;

/** One SMS staff can send this candidate. */
export interface SendableSmsMessage {
  messageCode: string;
  /** Also sent automatically when the candidate reaches its step. */
  automatic: boolean;
  /** The languages this message has a send.pk template for. */
  locales: SmsLocale[];
  /** The values its template uses (e.g. `country`), filled in by staff. */
  variables: string[];
  /** Values the candidate's record already has, per language. */
  prefilled: Partial<Record<SmsLocale, Record<string, string>>>;
}

export type SmsDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/** One SMS in the candidate's history. `sentBy` is undefined for an automatic one. */
export interface CandidateSmsDelivery {
  id: string;
  messageCode: string;
  locale: SmsLocale;
  status: SmsDeliveryStatus;
  errorCode?: string;
  sentBy?: { id: string; role: string };
  createdAt: string;
  sentAt?: string;
}

export interface CandidateSmsOverview {
  defaultLocale: SmsLocale;
  messages: SendableSmsMessage[];
  deliveries: CandidateSmsDelivery[];
}

export interface SendCandidateSmsInput {
  messageCode: string;
  locale: SmsLocale;
  variables: Record<string, string>;
}

export type AdminCandidateSmsErrorCode =
  | 'VALIDATION_FAILED'
  | 'FORBIDDEN'
  | 'INACTIVE_ACCOUNT'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'OFFLINE'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export interface AdminCandidateSmsError {
  code: AdminCandidateSmsErrorCode;
  /** The server's localized message, when it sent one. */
  message?: string;
  /** The field it applies to, e.g. `sms_message.variables.country`. */
  field?: string;
}

export interface AdminCandidateSmsClient {
  getOverview(candidateId: string): Promise<CandidateSmsOverview>;
  send(candidateId: string, input: SendCandidateSmsInput, idempotencyKey: string): Promise<CandidateSmsDelivery>;
}
