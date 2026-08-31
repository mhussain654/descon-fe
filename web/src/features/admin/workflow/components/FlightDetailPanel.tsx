import { useState } from 'react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import {
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
  OfflineState,
  Textarea,
  ValidationMessage,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { ADMIN_WORKFLOW_ERROR_KEYS } from '../../../../../../shared/adminWorkflow/errorMessages';
import { toWorkflowBlockingReason, WORKFLOW_BLOCKING_REASON_KEYS } from '../../../../../../shared/adminWorkflow/blockingReasons';
import type { AllowedWorkflowTransition } from '../../../../../../shared/adminWorkflow/types';
import { ADMIN_REVIEWER_ROLE_KEYS } from '../../../../../../shared/adminDocumentReviews/statusLabels';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { resolveDocumentAccessUrl } from '../../../../lib/resolveDocumentAccessUrl';
import { blockedOnlyByEvidenceFields } from '../blockedByOwnEvidence';
import type { useFlightActions } from '../hooks/useFlightActions';
import type { useFlightDetail } from '../hooks/useFlightDetail';
import { WorkflowFileField } from './WorkflowFileField';

/**
 * `flight_details_uploaded`'s required evidence fields, per the real
 * backend's StageRequirements (confirmed live against the running API).
 * The internal evidence key is `flight_reference`, not the flight-detail
 * controller's own public request field name `flight_number` (used by
 * useFlightActions.ts's FormData) -- the allowed-transitions endpoint's
 * blocking reasons use the former (`flight_reference_required`).
 */
const FLIGHT_REQUIRED_EVIDENCE_FIELDS = ['airline', 'flight_reference', 'sector', 'flight_date'];
/** The mobilization (PATCH) transition's own single required field. */
const MOBILIZE_REQUIRED_EVIDENCE_FIELDS = ['mobilized_on'];

export interface FlightDetailPanelProps {
  canTransition: boolean;
  flightTransition: AllowedWorkflowTransition | undefined;
  mobilizeTransition: AllowedWorkflowTransition | undefined;
  detailQuery: ReturnType<typeof useFlightDetail>;
  actions: ReturnType<typeof useFlightActions>;
  currentStageCode: string | undefined;
}

/**
 * Staff flight-details and mobilization panel (MPS-F501 Phase C). Once
 * `flightDetail.mobilized` is true the workflow has reached its terminal
 * stage -- every action here is hidden and the recorded details render
 * read-only, per the ticket's explicit "render the workflow and operational
 * details as view-only. Do not show further transition actions after the
 * terminal stage." (`flightTransition`/`mobilizeTransition` also stop being
 * offered by the backend at that point, same mechanism VisaDecisionPanel
 * relies on -- this check is a second, explicit guard for the one stage the
 * ticket calls out by name.)
 */
export function FlightDetailPanel({
  canTransition,
  flightTransition,
  mobilizeTransition,
  detailQuery,
  actions,
  currentStageCode,
}: FlightDetailPanelProps) {
  const { t, language } = useLanguage();

  if (detailQuery.isLoading) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <LoadingState message={t('loading')} />
      </div>
    );
  }
  if (detailQuery.error?.code === 'OFFLINE') {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <OfflineState
          title={t('dsOfflineTitle')}
          description={t('dsOfflineDescription')}
          retryLabel={t('retry')}
          onRetry={() => detailQuery.refetch()}
        />
      </div>
    );
  }
  if (detailQuery.error) {
    const messageKey = ADMIN_WORKFLOW_ERROR_KEYS[detailQuery.error.code] as TranslationKey;
    return (
      <div className="mt-6 border-t border-border pt-6">
        <ErrorState message={detailQuery.error.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => detailQuery.refetch()} />
      </div>
    );
  }

  const flightDetail = detailQuery.data?.flightDetail ?? null;
  const isMobilized = flightDetail?.mobilized === true;

  const canAttemptFlight =
    !isMobilized &&
    !flightDetail &&
    !!flightTransition &&
    (flightTransition.allowed || blockedOnlyByEvidenceFields(flightTransition, FLIGHT_REQUIRED_EVIDENCE_FIELDS));
  const flightGenuinelyBlocked =
    !isMobilized &&
    !flightDetail &&
    !!flightTransition &&
    !flightTransition.allowed &&
    !canAttemptFlight &&
    flightTransition.blockingReasons.length > 0;

  const canAttemptMobilize =
    !isMobilized &&
    !!flightDetail &&
    !!mobilizeTransition &&
    (mobilizeTransition.allowed || blockedOnlyByEvidenceFields(mobilizeTransition, MOBILIZE_REQUIRED_EVIDENCE_FIELDS));
  const mobilizeGenuinelyBlocked =
    !isMobilized &&
    !!flightDetail &&
    !!mobilizeTransition &&
    !mobilizeTransition.allowed &&
    !canAttemptMobilize &&
    mobilizeTransition.blockingReasons.length > 0;

  const isThisTicketAccess = actions.ticketAccess.access !== null;

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('adminWorkflowFlightPanelTitle')}</h3>
        <div className="flex flex-wrap gap-2">
          {canAttemptFlight && canTransition ? (
            <Button type="button" variant="secondary" onClick={actions.openRecordDialog}>
              {t('adminWorkflowFlightAddDetailsAction')}
            </Button>
          ) : null}
          {canAttemptMobilize && canTransition ? (
            <Button type="button" onClick={actions.openMobilizeDialog}>
              {t('adminWorkflowMobilizeAction')}
            </Button>
          ) : null}
        </div>
      </div>

      {flightGenuinelyBlocked ? (
        <ul className="mb-3 space-y-1">
          {flightTransition!.blockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {mobilizeGenuinelyBlocked ? (
        <ul className="mb-3 space-y-1">
          {mobilizeTransition!.blockingReasons.map((reason) => (
            <li key={reason}>
              <ValidationMessage tone="error">
                {t(WORKFLOW_BLOCKING_REASON_KEYS[toWorkflowBlockingReason(reason)] as TranslationKey)}
              </ValidationMessage>
            </li>
          ))}
        </ul>
      ) : null}
      {(canAttemptFlight || canAttemptMobilize) && !canTransition ? (
        <p className="mb-3 text-xs text-text-tertiary">{t('adminWorkflowViewOnlyNotice')}</p>
      ) : null}

      {!flightDetail ? (
        <p className="text-sm text-text-secondary">{t('adminWorkflowFlightNoDetails')}</p>
      ) : (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-text-primary">
              {flightDetail.airline} {flightDetail.flightNumber}
            </div>
            {isMobilized ? <Badge tone="success">{t('adminWorkflowFlightMobilizedBadge')}</Badge> : null}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-tertiary">
            <div>
              <dt>{t('adminWorkflowFlightSectorLabel')}</dt>
              <dd className="text-text-primary">{flightDetail.sector}</dd>
            </div>
            <div>
              <dt>{t('adminWorkflowFlightDepartureLabel')}</dt>
              <dd className="text-text-primary">
                {formatDate(flightDetail.flightDepartureAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
              </dd>
            </div>
            {flightDetail.mobilizedOn ? (
              <div>
                <dt>{t('adminWorkflowMobilizedOnLabel')}</dt>
                <dd className="text-text-primary">{formatDate(flightDetail.mobilizedOn, language, { dateStyle: 'medium' })}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-1 text-xs text-text-tertiary">
            {t('adminWorkflowRecordedByPrefix')}{' '}
            {flightDetail.recordedBy ? t(ADMIN_REVIEWER_ROLE_KEYS[flightDetail.recordedBy.role] as TranslationKey) : t('adminWorkflowUnknownActor')}
          </div>
          {flightDetail.ticketAttached ? (
            <div className="mt-2">
              {isThisTicketAccess && actions.ticketAccess.access && !actions.ticketAccess.isExpired ? (
                <a
                  href={resolveDocumentAccessUrl(actions.ticketAccess.access.url, import.meta.env.VITE_API_BASE_URL ?? '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-primary underline"
                >
                  {t('adminWorkflowFlightOpenTicketAction')}
                </a>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={actions.requestTicketAccess}
                  disabled={actions.ticketAccess.isRequesting}
                >
                  {t('adminWorkflowFlightViewTicketAction')}
                </Button>
              )}
              {isThisTicketAccess && actions.ticketAccess.isExpired ? (
                <p className="mt-1 text-xs text-text-tertiary">{t('adminWorkflowAccessExpiredMessage')}</p>
              ) : null}
              {isThisTicketAccess && actions.ticketAccess.error ? (
                <ValidationMessage tone="error">
                  {actions.ticketAccess.error.message || t(ADMIN_WORKFLOW_ERROR_KEYS[actions.ticketAccess.error.code] as TranslationKey)}
                </ValidationMessage>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {actions.staleNotice ? (
        <div className="mt-3">
          <ValidationMessage tone="error">{t('adminWorkflowStaleNoticeMessage')}</ValidationMessage>
        </div>
      ) : null}

      <RecordFlightDetailDialog actions={actions} currentStageCode={currentStageCode} />
      <MobilizeDialog actions={actions} currentStageCode={currentStageCode} flightDepartureAt={flightDetail?.flightDepartureAt} />
    </div>
  );
}

function RecordFlightDetailDialog({
  actions,
  currentStageCode,
}: {
  actions: ReturnType<typeof useFlightActions>;
  currentStageCode: string | undefined;
}) {
  const { t } = useLanguage();
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ airline?: string; flightNumber?: string; sector?: string; flightDate?: string }>({});

  const mutationError = actions.recordMutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  const generalError =
    mutationError && !conflictMessage
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    actions.closeRecordDialog();
    setNote('');
    setFieldErrors({});
  };

  const handleConfirm = () => {
    const nextErrors: typeof fieldErrors = {};
    if (!actions.airline.trim()) nextErrors.airline = t('adminWorkflowFlightAirlineRequiredError');
    if (!actions.flightNumber.trim()) nextErrors.flightNumber = t('adminWorkflowFlightNumberRequiredError');
    if (!actions.sector.trim()) nextErrors.sector = t('adminWorkflowFlightSectorRequiredError');
    if (!actions.flightDate) nextErrors.flightDate = t('adminWorkflowFlightDateRequiredError');
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    actions.submitRecord(currentStageCode, note.trim() || undefined);
  };

  return (
    <ConfirmDialog
      open={actions.recordDialogOpen}
      onOpenChange={handleOpenChange}
      title={t('adminWorkflowFlightDialogTitle')}
      description={t('adminWorkflowFlightDialogDescription')}
      confirmLabel={t('adminWorkflowFlightConfirmAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={actions.recordMutation.isPending}
    >
      <div className="space-y-4">
        <Input
          label={t('adminWorkflowFlightAirlineLabel')}
          value={actions.airline}
          onChange={(event) => actions.setAirline(event.target.value)}
          errorMessage={fieldErrors.airline}
        />
        <Input
          label={t('adminWorkflowFlightNumberLabel')}
          value={actions.flightNumber}
          onChange={(event) => actions.setFlightNumber(event.target.value)}
          errorMessage={fieldErrors.flightNumber}
        />
        <Input
          label={t('adminWorkflowFlightSectorLabel')}
          value={actions.sector}
          onChange={(event) => actions.setSector(event.target.value)}
          errorMessage={fieldErrors.sector}
        />
        <Input
          type="datetime-local"
          label={t('adminWorkflowFlightDepartureLabel')}
          value={actions.flightDate}
          onChange={(event) => actions.setFlightDate(event.target.value)}
          errorMessage={fieldErrors.flightDate}
        />
        <WorkflowFileField
          file={actions.ticket}
          error={actions.ticketError ? t('adminWorkflowFlightTicketRequiredError') : undefined}
          onSelect={actions.selectTicket}
          disabled={actions.recordMutation.isPending}
          labelText={t('adminWorkflowFlightTicketLabel')}
          chooseFileLabel={t('adminWorkflowChooseFileAction')}
          noFileChosenLabel={t('adminWorkflowNoFileChosen')}
          selectedFilePrefix={t('adminWorkflowSelectedFilePrefix')}
          removeFileLabel={t('adminWorkflowRemoveFileAction')}
        />
        <Textarea label={t('adminWorkflowQvcNoteLabel')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}

function MobilizeDialog({
  actions,
  currentStageCode,
  flightDepartureAt,
}: {
  actions: ReturnType<typeof useFlightActions>;
  currentStageCode: string | undefined;
  flightDepartureAt: string | undefined;
}) {
  const { t, language } = useLanguage();
  const [note, setNote] = useState('');
  const [dateError, setDateError] = useState<string | undefined>(undefined);

  const mutationError = actions.mobilizeMutation.error;
  const conflictMessage =
    mutationError?.code === 'IDEMPOTENCY_CONFLICT'
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS.IDEMPOTENCY_CONFLICT as TranslationKey)
      : undefined;
  // The backend's own flight_mobilization_date_invalid validation error
  // surfaces through the generic VALIDATION_ERROR mapping (no dedicated
  // AdminWorkflowErrorCode) -- its localized `message` is what actually
  // explains the invalid sequencing to the user (ticket: "Explain invalid
  // date sequencing."), the generic fallback key is only a last resort.
  const generalError =
    mutationError && !conflictMessage
      ? mutationError.message || t(ADMIN_WORKFLOW_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    actions.closeMobilizeDialog();
    setNote('');
    setDateError(undefined);
  };

  const handleConfirm = () => {
    if (!actions.mobilizedOn) {
      setDateError(t('adminWorkflowMobilizedOnRequiredError'));
      return;
    }
    setDateError(undefined);
    actions.submitMobilize(currentStageCode, note.trim() || undefined);
  };

  return (
    <ConfirmDialog
      open={actions.mobilizeDialogOpen}
      onOpenChange={handleOpenChange}
      title={t('adminWorkflowMobilizeDialogTitle')}
      description={t('adminWorkflowMobilizeDialogDescription')}
      confirmLabel={t('adminWorkflowMobilizeConfirmAction')}
      cancelLabel={t('adminWorkflowCancelAction')}
      closeLabel={t('dsClose')}
      onConfirm={handleConfirm}
      isConfirming={actions.mobilizeMutation.isPending}
    >
      <div className="space-y-4">
        {flightDepartureAt ? (
          <p className="text-xs text-text-tertiary">
            {t('adminWorkflowFlightDepartureLabel')}: {formatDate(flightDepartureAt, language, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        ) : null}
        <Input
          type="date"
          label={t('adminWorkflowMobilizedOnLabel')}
          value={actions.mobilizedOn}
          onChange={(event) => actions.setMobilizedOn(event.target.value)}
          errorMessage={dateError}
        />
        <Textarea label={t('adminWorkflowQvcNoteLabel')} value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
        {conflictMessage ? <ValidationMessage tone="error">{conflictMessage}</ValidationMessage> : null}
        {generalError ? <ValidationMessage tone="error">{generalError}</ValidationMessage> : null}
      </div>
    </ConfirmDialog>
  );
}
