import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, PhoneCall, Users } from 'lucide-react';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Input, Pagination, Select, StatTile, ValidationMessage, type DataTableColumn } from '../../../../design-system';
import type { BulkCallBatch, BulkCallCalledFilter, BulkCallCandidateRow, BulkCallCandidatesQuery } from '../../../../lib/admin-bulk-calls-client';
import { BULK_CALL_ERROR_KEYS } from '../../../../../../shared/adminBulkCalls/errorMessages';
import { bulkCallOutcomeText, bulkCallStateLabel, bulkCallStateTone } from '../../../../../../shared/adminBulkCalls/labels';
import { ORDERED_WORKFLOW_STAGE_CODES, workflowStageLabelKey } from '../../../../../../shared/adminCandidates/workflowStageLabels';
import { formatDate, formatNumber } from '../../../../../../shared/i18n/locale';
import { interpolate } from '../../../../../../shared/i18n/interpolate';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useDebouncedValue } from '../../documentReviews/hooks/useDebouncedValue';
import { useBulkCallCandidates } from '../hooks/useBulkCallCandidates';
import { useRobocallVoices } from '../hooks/useRobocallVoices';
import { useStartBulkCall } from '../hooks/useStartBulkCall';
import { QueryStateView } from './QueryStateView';

const PAGE_SIZE = 25;
const CALLED_OPTIONS: { value: BulkCallCalledFilter; labelKey: TranslationKey }[] = [
  { value: 'not_called', labelKey: 'adminBulkCallShowNotCalled' },
  { value: 'called', labelKey: 'adminBulkCallShowCalled' },
  { value: 'all', labelKey: 'adminBulkCallShowAll' },
];

function stageName(code: string, t: (key: TranslationKey) => string): string {
  const key = workflowStageLabelKey(code);
  return key ? t(key) : code;
}

/**
 * The bulk-call page's working area: choose one workflow stage and one call type,
 * see who at that stage is still to be called (and who already was), and start a
 * batch for the next few -- at most the batch limit the backend enforces. After a
 * batch the list refreshes, so what is left to call is always visible and another
 * batch can be started for the rest.
 */
export function BulkCallPlanner() {
  const { t, language } = useLanguage();
  const voices = useRobocallVoices();
  const start = useStartBulkCall();
  const [stageCode, setStageCode] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [called, setCalled] = useState<BulkCallCalledFilter>('not_called');
  const [searchDraft, setSearchDraft] = useState('');
  const search = useDebouncedValue(searchDraft.trim(), 400);
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [started, setStarted] = useState<BulkCallBatch | null>(null);

  // A changed selection starts again from the first page.
  useEffect(() => setPage(1), [stageCode, voiceId, called, search]);

  const activeVoices = (voices.data ?? []).filter((voice) => voice.active);
  const chosenVoice = activeVoices.find((voice) => voice.id === voiceId);
  const ready = stageCode !== '' && chosenVoice !== undefined;
  const query: BulkCallCandidatesQuery | undefined = ready
    ? { voiceId, stageCode, called, search: search || undefined, page, pageSize: PAGE_SIZE }
    : undefined;
  const candidates = useBulkCallCandidates(query);

  const summary = candidates.data?.summary;
  const batchLimit = candidates.data?.batchLimit ?? 0;
  const nextCount = summary ? Math.min(summary.remaining, batchLimit) : 0;
  const number = (value: number) => formatNumber(value, language);

  const startBatch = () =>
    start.mutate(
      { voiceId, stageCode, limit: nextCount, search: search || undefined },
      {
        onSuccess: (batch) => {
          setConfirmOpen(false);
          setStarted(batch);
        },
      }
    );

  const columns: DataTableColumn<BulkCallCandidateRow>[] = [
    { key: 'name', header: t('adminBulkCallColumnName'), render: (row) => <span className="font-medium text-text-primary">{row.fullName}</span> },
    { key: 'reference', header: t('adminBulkCallColumnReference'), render: (row) => row.referenceNumber ?? t('notAvailable') },
    { key: 'phone', header: t('adminBulkCallColumnPhone'), render: (row) => <span dir="ltr">{row.mobileNumberMasked}</span> },
    {
      key: 'call',
      header: t('adminBulkCallColumnCall'),
      render: (row) => <Badge tone={bulkCallStateTone(row.callState)}>{bulkCallStateLabel(row.callState, t)}</Badge>,
    },
    {
      key: 'last',
      header: t('adminBulkCallColumnLastCall'),
      render: (row) =>
        row.lastCall
          ? [formatDate(row.lastCall.calledAt, language, { dateStyle: 'medium', timeStyle: 'short' }), bulkCallOutcomeText(row.lastCall.outcome, row.lastCall.outcomeReason, t)].filter(Boolean).join(' · ')
          : t('notAvailable'),
    },
  ];

  const startError = start.isError ? start.error : undefined;
  const startErrorMessage = startError ? startError.message || t((BULK_CALL_ERROR_KEYS[startError.code] ?? 'somethingWentWrong') as TranslationKey) : undefined;

  return (
    <>
      <Card className="mb-5 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">{t('adminBulkCallPlannerTitle')}</h2>
            <p className="text-xs text-text-secondary">{t('adminBulkCallPlannerDescription')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label={t('adminBulkCallStageLabel')}
            value={stageCode}
            onChange={(event) => setStageCode(event.target.value)}
            options={[{ value: '', label: t('adminBulkCallStagePlaceholder') }, ...ORDERED_WORKFLOW_STAGE_CODES.map((code) => ({ value: code, label: stageName(code, t) }))]}
          />
          <Select
            label={t('adminBulkCallVoiceLabel')}
            value={voiceId}
            onChange={(event) => setVoiceId(event.target.value)}
            options={[
              { value: '', label: t('adminBulkCallVoicePlaceholder') },
              ...activeVoices.map((voice) => ({ value: voice.id, label: language === 'ur' && voice.nameUr ? voice.nameUr : voice.nameEn })),
            ]}
          />
          <Select
            label={t('adminBulkCallShowLabel')}
            value={called}
            onChange={(event) => setCalled(event.target.value as BulkCallCalledFilter)}
            options={CALLED_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />
          <Input
            label={t('adminBulkCallSearchLabel')}
            placeholder={t('adminBulkCallSearchPlaceholder')}
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </div>
        {voices.isSuccess && activeVoices.length === 0 ? <p className="mt-4 text-sm text-text-secondary">{t('adminBulkCallNoCallTypes')}</p> : null}
      </Card>

      {started ? (
        <Card className="mb-5 border-success p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-text-primary">{t('adminBulkCallStartedTitle')}</h2>
                <p className="text-sm text-text-secondary">{interpolate(t('adminBulkCallStartedDescription'), { count: number(started.selectedCount) })}</p>
              </div>
            </div>
            <Link to={`/admin/bulk-calls/${encodeURIComponent(started.id)}`} className="text-sm font-semibold text-brand hover:underline">
              {t('adminBulkCallViewResults')}
            </Link>
          </div>
        </Card>
      ) : null}

      {!ready ? (
        <EmptyState title={t('adminBulkCallEmptyTitle')} description={t('adminBulkCallChooseFirst')} />
      ) : (
        <QueryStateView query={candidates}>
          {summary ? (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile value={number(summary.matching)} label={t('adminBulkCallTileMatching')} className="bg-brand-subtle/45 text-brand" />
                <StatTile value={number(summary.called)} label={t('adminBulkCallTileCalled')} className="bg-success-subtle/55 text-success-emphasis" />
                <StatTile value={number(summary.remaining)} label={t('adminBulkCallTileRemaining')} className="bg-warning-subtle/55 text-warning-emphasis" />
                <StatTile value={number(batchLimit)} label={t('adminBulkCallTileLimit')} className="bg-info-subtle/55 text-info-emphasis" />
              </div>

              <Card className="mb-5 p-5">
                {nextCount > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-text-primary">{interpolate(t('adminBulkCallNextBatch'), { count: number(nextCount) })}</p>
                      {summary.remaining > batchLimit ? (
                        <p className="mt-1 text-sm text-text-secondary">
                          {interpolate(t('adminBulkCallMoreRemain'), { remaining: number(summary.remaining), count: number(nextCount) })}
                        </p>
                      ) : null}
                    </div>
                    <Button onClick={() => setConfirmOpen(true)} disabled={start.isPending}>
                      <PhoneCall className="me-1.5 h-4 w-4" aria-hidden="true" />
                      {interpolate(t('adminBulkCallStartAction'), { count: number(nextCount) })}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">{t('adminBulkCallNothingLeft')}</p>
                )}
              </Card>
            </>
          ) : null}

          {(candidates.data?.candidates ?? []).length === 0 ? (
            <EmptyState title={t('adminBulkCallEmptyTitle')} description={t(called === 'not_called' ? 'adminBulkCallEmptyNotCalled' : 'adminBulkCallEmptyOther')} />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 px-1 text-sm text-text-secondary">
                <Users className="h-4 w-4 text-brand" aria-hidden="true" />
                <strong className="font-semibold text-text-primary">{number(candidates.data?.pagination.totalCount ?? 0)}</strong>
              </div>
              <Card noPadding className="min-w-0 overflow-hidden">
                <DataTable columns={columns} rows={candidates.data?.candidates ?? []} getRowId={(row) => row.id} />
              </Card>
              {candidates.data && candidates.data.pagination.totalPages > 1 ? (
                <div className="mt-4">
                  <Pagination
                    page={candidates.data.pagination.page}
                    pageCount={candidates.data.pagination.totalPages}
                    onPageChange={setPage}
                    previousLabel={t('dsPreviousPage')}
                    nextLabel={t('dsNextPage')}
                  />
                </div>
              ) : null}
            </>
          )}
        </QueryStateView>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) start.reset();
        }}
        title={t('adminBulkCallConfirmTitle')}
        description={interpolate(t('adminBulkCallConfirmDescription'), {
          count: number(nextCount),
          stage: stageName(stageCode, t),
          voice: chosenVoice ? (language === 'ur' && chosenVoice.nameUr ? chosenVoice.nameUr : chosenVoice.nameEn) : '',
        })}
        confirmLabel={t('adminBulkCallConfirmAction')}
        cancelLabel={t('adminBulkCallCancelAction')}
        closeLabel={t('dsClose')}
        onConfirm={startBatch}
        isConfirming={start.isPending}
      >
        {startErrorMessage ? <ValidationMessage>{startErrorMessage}</ValidationMessage> : null}
      </ConfirmDialog>
    </>
  );
}
