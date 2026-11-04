import { useEffect, useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { Badge, Button, Card, Input, RetryBanner, Select, ValidationMessage, toast } from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { smsMessageLabelKey, smsVariableLabelKey } from '../../../../../../shared/adminCandidateSms/messageLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type {
  CandidateSmsDelivery,
  SendableSmsMessage,
  SmsDeliveryStatus,
  SmsLocale,
} from '../../../../../../shared/adminCandidateSms/types';
import { useCandidateSmsOverview, useSendCandidateSms } from '../hooks/useCandidateSms';

const STATUS_TONES: Record<SmsDeliveryStatus, 'neutral' | 'success' | 'danger' | 'warning'> = {
  pending: 'warning',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

const STATUS_KEYS: Record<SmsDeliveryStatus, TranslationKey> = {
  pending: 'adminCandidateSmsStatusPending',
  sent: 'adminCandidateSmsStatusSent',
  failed: 'adminCandidateSmsStatusFailed',
  skipped: 'adminCandidateSmsStatusSkipped',
};

const LANGUAGE_KEYS: Record<SmsLocale, TranslationKey> = {
  en: 'adminCandidateSmsLanguageEnglish',
  ur: 'adminCandidateSmsLanguageUrdu',
};

/**
 * The candidate page's "SMS" tab: send any SMS that has a send.pk template, in
 * English or Urdu (the candidate's own language preselected), filling in the
 * values it needs -- and the history of every SMS the candidate was sent,
 * automatic and manual.
 */
export function CandidateSmsCard({ candidateId }: { candidateId: string }) {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const query = useCandidateSmsOverview(candidateId);

  useEffect(() => {
    const code = query.error?.code;
    if (code === 'SESSION_EXPIRED') signOut('expired');
    else if (code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  if (query.isLoading) return null;
  if (query.isError) {
    return (
      <Card>
        <RetryBanner message={query.error.message || t('adminCandidateSmsLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
      </Card>
    );
  }

  const overview = query.data;
  if (!overview) return null;

  return (
    <>
      <SendSmsForm candidateId={candidateId} messages={overview.messages} defaultLocale={overview.defaultLocale} />
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateSmsHistoryTitle')}</h2>
        {overview.deliveries.length === 0 ? (
          <p className="text-sm text-text-tertiary">{t('adminCandidateSmsHistoryEmpty')}</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {overview.deliveries.map((delivery) => (
              <DeliveryRow key={delivery.id} delivery={delivery} language={language} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function DeliveryRow({ delivery, language }: { delivery: CandidateSmsDelivery; language: SmsLocale }) {
  const { t } = useLanguage();

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="text-sm font-medium text-text-primary">{t(smsMessageLabelKey(delivery.messageCode))}</span>
      <Badge tone="neutral">{t(LANGUAGE_KEYS[delivery.locale])}</Badge>
      <Badge tone={STATUS_TONES[delivery.status]}>{t(STATUS_KEYS[delivery.status])}</Badge>
      <span className="text-xs text-text-tertiary">
        {delivery.sentBy ? `${t('adminCandidateSmsSentByLabel')}: ${delivery.sentBy.role}` : t('adminCandidateSmsAutomaticLabel')}
        {' · '}
        {formatDate(delivery.createdAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
      </span>
    </li>
  );
}

interface SendSmsFormProps {
  candidateId: string;
  messages: SendableSmsMessage[];
  defaultLocale: SmsLocale;
}

function SendSmsForm({ candidateId, messages, defaultLocale }: SendSmsFormProps) {
  const { t } = useLanguage();
  const { send, mutation } = useSendCandidateSms(candidateId);
  const [messageCode, setMessageCode] = useState('');
  const [locale, setLocale] = useState<SmsLocale>(defaultLocale);
  const [values, setValues] = useState<Record<string, string>>({});

  const message = messages.find((candidate) => candidate.messageCode === messageCode);

  /** Picks a language the message has a template for, the candidate's own when it can. */
  const choose = (next: SendableSmsMessage | undefined, preferred: SmsLocale) => {
    const nextLocale = next && !next.locales.includes(preferred) ? next.locales[0] : preferred;
    setLocale(nextLocale);
    setValues({ ...(next?.prefilled[nextLocale] ?? {}) });
    mutation.reset();
  };

  const fieldError = (variable: string) =>
    mutation.error?.field === `sms_message.variables.${variable}` ? mutation.error.message || t('adminCandidateSmsValueRequired') : undefined;
  const formError = mutation.isError && !mutation.error.field?.startsWith('sms_message.variables.') ? mutation.error.message || t('somethingWentWrong') : undefined;
  const missingValue = message?.variables.some((variable) => !values[variable]?.trim()) ?? true;

  const submit = () => {
    if (!message || missingValue) return;
    send(
      { messageCode: message.messageCode, locale, variables: Object.fromEntries(message.variables.map((variable) => [variable, values[variable].trim()])) },
      {
        onSuccess: () => {
          toast.success(t('adminCandidateSmsSentToast'));
          setMessageCode('');
          setValues({});
        },
      }
    );
  };

  return (
    <Card>
      <h2 className="text-sm font-semibold text-text-primary">{t('adminCandidateSmsSendTitle')}</h2>
      {messages.length === 0 ? (
        <p className="mt-3 text-sm text-text-tertiary">{t('adminCandidateSmsNoMessages')}</p>
      ) : (
        <div className="mt-3 space-y-4">
          <Select
            label={t('adminCandidateSmsMessageLabel')}
            value={messageCode}
            onChange={(event) => {
              setMessageCode(event.target.value);
              choose(messages.find((candidate) => candidate.messageCode === event.target.value), defaultLocale);
            }}
            options={[
              { value: '', label: t('adminCandidateSmsMessagePlaceholder') },
              ...messages.map((option) => ({
                value: option.messageCode,
                label: option.automatic ? `${t(smsMessageLabelKey(option.messageCode))} (${t('adminCandidateSmsAutomaticLabel')})` : t(smsMessageLabelKey(option.messageCode)),
              })),
            ]}
          />

          {message ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-text-primary">{t('adminCandidateSmsLanguageLabel')}</legend>
                <div className="flex flex-wrap gap-4">
                  {(['en', 'ur'] as const).map((option) => {
                    const available = message.locales.includes(option);
                    return (
                      <label key={option} className={`inline-flex items-center gap-2 text-sm ${available ? 'text-text-primary' : 'text-text-tertiary'}`}>
                        <input
                          type="radio"
                          name={`sms-language-${candidateId}`}
                          value={option}
                          checked={locale === option}
                          disabled={!available}
                          onChange={() => choose(message, option)}
                          className="h-4 w-4 accent-brand"
                        />
                        {t(LANGUAGE_KEYS[option])}
                        {!available ? <span className="text-xs">({t('adminCandidateSmsNoTemplateForLanguage')})</span> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {message.variables.map((variable) => (
                <Input
                  key={variable}
                  label={t(smsVariableLabelKey(variable))}
                  value={values[variable] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [variable]: event.target.value }))}
                  errorMessage={fieldError(variable)}
                  dir={locale === 'ur' ? 'rtl' : 'ltr'}
                  maxLength={100}
                  autoComplete="off"
                />
              ))}

              {formError ? <ValidationMessage>{formError}</ValidationMessage> : null}

              <div className="flex justify-end">
                <Button onClick={submit} loading={mutation.isPending} disabled={missingValue}>
                  {t('adminCandidateSmsSendAction')}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}
