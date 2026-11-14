import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ServerCog } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  Pagination,
  RetryBanner,
  Select,
  type BadgeTone,
} from '../../../../design-system';
import { formatDate } from '../../../../../../shared/i18n/locale';
import { JOB_LOG_ERROR_KEYS } from '../../../../../../shared/adminJobLogs/errorMessages';
import { JOB_LOG_STATUSES } from '../../../../../../shared/adminJobLogs/types';
import type { Language, TranslationKey } from '../../../../../../shared/i18n/translations';
import type { JobLog, JobLogListFilters, JobLogStatus } from '../../../../lib/admin-job-logs-client';
import { useJobLogList } from '../hooks/useJobLogList';
import { readJobLogListState, writeJobLogListState } from '../jobLogListUrlState';

type Translate = (key: TranslationKey) => string;

const STATUS_LABEL_KEYS: Record<JobLogStatus, TranslationKey> = {
  pending: 'adminJobLogsStatusPending',
  scheduled: 'adminJobLogsStatusScheduled',
  running: 'adminJobLogsStatusRunning',
  finished: 'adminJobLogsStatusFinished',
  failed: 'adminJobLogsStatusFailed',
};

const STATUS_TONES: Record<JobLogStatus, BadgeTone> = {
  pending: 'neutral',
  scheduled: 'info',
  running: 'brand',
  finished: 'success',
  failed: 'danger',
};

/**
 * Developer-only Job logs: background job runs from Solid Queue with a job,
 * status and enqueued-date filter kept in the URL. A failed run expands to
 * show its error. The backend (view_job_logs) is the real boundary; the
 * route and nav link are hidden from everyone else.
 */
export function JobLogList() {
  const { t, language } = useLanguage();
  const { signOut } = useStaffAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = readJobLogListState(searchParams);
  const query = useJobLogList(filters, page);
  // Remember the job list across filter changes, so the dropdown never empties while a new page loads.
  const [jobClasses, setJobClasses] = useState<string[]>([]);

  useEffect(() => {
    if (query.data?.jobClasses.length) setJobClasses(query.data.jobClasses);
  }, [query.data]);

  useEffect(() => {
    if (query.error?.code === 'SESSION_EXPIRED') signOut('expired');
    else if (query.error?.code === 'INACTIVE_ACCOUNT') signOut('manual');
  }, [query.error, signOut]);

  const updateFilters = useCallback(
    (patch: Partial<JobLogListFilters>) => setSearchParams(writeJobLogListState({ ...filters, ...patch }, {})),
    [filters, setSearchParams]
  );

  const hasActiveFilters = Boolean(filters.jobClass || filters.status || filters.enqueuedFrom || filters.enqueuedTo);
  const jobOptions = [
    { value: '', label: t('adminJobLogsFilterAllJobs') },
    ...(filters.jobClass && !jobClasses.includes(filters.jobClass) ? [filters.jobClass] : []).concat(jobClasses)
      .map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div className="relative flex items-center gap-4 px-5 py-6 sm:px-6 lg:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
            <ServerCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t('adminJobLogsEyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('adminJobLogsTitle')}</h1>
            <p className="mt-1 text-sm text-white/80">{t('adminJobLogsSubtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="mb-5 p-4 sm:p-5">
        <h2 className="mb-1 font-semibold text-text-primary">{t('adminJobLogsFilterTitle')}</h2>
        <p className="mb-4 text-xs text-text-secondary">{t('adminJobLogsRetention')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label={t('adminJobLogsFilterJob')}
            value={filters.jobClass ?? ''}
            onChange={(event) => updateFilters({ jobClass: event.target.value || undefined })}
            options={jobOptions}
          />
          <Select
            label={t('adminJobLogsFilterStatus')}
            value={filters.status ?? ''}
            onChange={(event) => updateFilters({ status: (event.target.value || undefined) as JobLogStatus | undefined })}
            options={[
              { value: '', label: t('adminJobLogsFilterAllStatuses') },
              ...JOB_LOG_STATUSES.map((status) => ({ value: status, label: t(STATUS_LABEL_KEYS[status]) })),
            ]}
          />
          <Input
            type="date"
            label={t('adminJobLogsFilterFrom')}
            value={filters.enqueuedFrom ?? ''}
            max={filters.enqueuedTo}
            onChange={(event) => updateFilters({ enqueuedFrom: event.target.value || undefined })}
          />
          <Input
            type="date"
            label={t('adminJobLogsFilterTo')}
            value={filters.enqueuedTo ?? ''}
            min={filters.enqueuedFrom}
            onChange={(event) => updateFilters({ enqueuedTo: event.target.value || undefined })}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {query.data ? (
            <p className="text-sm text-text-secondary">
              {t('adminJobLogsTotal')}: <span className="font-semibold text-text-primary">{query.data.pagination.totalCount}</span>
            </p>
          ) : (
            <span />
          )}
          {hasActiveFilters ? (
            <button type="button" onClick={() => setSearchParams(new URLSearchParams())} className="text-sm font-medium text-brand hover:underline">
              {t('adminJobLogsClearFilters')}
            </button>
          ) : null}
        </div>
      </Card>

      <ListContent
        query={query}
        hasActiveFilters={hasActiveFilters}
        onPageChange={(number) => setSearchParams(writeJobLogListState(filters, { number }))}
        t={t}
        language={language}
      />
    </div>
  );
}

interface ListContentProps {
  query: ReturnType<typeof useJobLogList>;
  hasActiveFilters: boolean;
  onPageChange: (page: number) => void;
  t: Translate;
  language: Language;
}

function ListContent({ query, hasActiveFilters, onPageChange, t, language }: ListContentProps) {
  if (query.isLoading) return <LoadingState message={t('loading')} />;

  if (query.isError && !query.data) {
    const error = query.error;
    if (error?.code === 'OFFLINE') {
      return <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
    }
    if (error?.code === 'FORBIDDEN') return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
    if (error?.code === 'SESSION_EXPIRED' || error?.code === 'INACTIVE_ACCOUNT') return null;
    const messageKey = (error ? JOB_LOG_ERROR_KEYS[error.code] : 'somethingWentWrong') as TranslationKey;
    return <ErrorState message={error?.message || t(messageKey)} retryLabel={t('retry')} onRetry={() => query.refetch()} />;
  }

  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  if (items.length === 0) {
    return hasActiveFilters ? (
      <EmptyState title={t('adminJobLogsEmptyFilteredTitle')} description={t('adminJobLogsEmptyFilteredDescription')} />
    ) : (
      <EmptyState title={t('adminJobLogsEmptyTitle')} description={t('adminJobLogsEmptyDescription')} />
    );
  }

  return (
    <div>
      {query.isError ? (
        <div className="mb-4">
          <RetryBanner message={t('adminJobLogsLoadError')} retryLabel={t('retry')} onRetry={() => query.refetch()} />
        </div>
      ) : null}
      <ul className="space-y-3">
        {items.map((job) => (
          <JobLogCard key={job.id} job={job} t={t} language={language} />
        ))}
      </ul>
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4">
          <Pagination
            page={pagination.page}
            pageCount={pagination.totalPages}
            onPageChange={onPageChange}
            previousLabel={t('dsPreviousPage')}
            nextLabel={t('dsNextPage')}
          />
        </div>
      ) : null}
    </div>
  );
}

function JobLogCard({ job, t, language }: { job: JobLog; t: Translate; language: Language }) {
  const [expanded, setExpanded] = useState(false);
  const format = (value: string) => formatDate(value, language, { dateStyle: 'medium', timeStyle: 'medium' });
  const times: Array<[TranslationKey, string | undefined]> = [
    ['adminJobLogsEnqueued', job.enqueuedAt],
    ['adminJobLogsScheduledFor', job.status === 'scheduled' ? job.scheduledAt : undefined],
    ['adminJobLogsStarted', job.startedAt],
    ['adminJobLogsFinished', job.finishedAt],
    ['adminJobLogsFailedAt', job.failedAt],
  ];
  const errorId = `job-log-error-${job.id}`;

  return (
    <li>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-semibold text-text-primary" dir="ltr">{job.jobClass}</p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              #{job.id} · {t('adminJobLogsQueue')}: {job.queueName}
              {job.attempt ? ` · ${t('adminJobLogsAttempt')}: ${job.attempt}` : ''}
            </p>
          </div>
          <div className="shrink-0">
            <Badge tone={STATUS_TONES[job.status]}>{t(STATUS_LABEL_KEYS[job.status])}</Badge>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {times
            .filter((entry): entry is [TranslationKey, string] => Boolean(entry[1]))
            .map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs text-text-tertiary">{t(key)}</dt>
                <dd className="text-text-secondary">{format(value)}</dd>
              </div>
            ))}
        </dl>

        {job.error ? (
          <div className="mt-3 border-t border-border-subtle pt-3">
            <p className="break-words text-sm text-danger-emphasis" dir="ltr">
              <span className="font-mono font-semibold">{job.error.exceptionClass}</span>
            </p>
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              aria-controls={errorId}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-text-secondary hover:bg-surface-sunken"
            >
              {expanded ? t('adminJobLogsHideError') : t('adminJobLogsShowError')}
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded ? (
              <div id={errorId} className="mt-3 space-y-3" dir="ltr">
                <div>
                  <p className="text-xs font-semibold text-text-tertiary">{t('adminJobLogsErrorMessage')}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-primary">{job.error.message}</p>
                </div>
                {job.error.backtrace.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-text-tertiary">{t('adminJobLogsBacktrace')}</p>
                    <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-surface-sunken p-3 text-xs leading-relaxed text-text-secondary">
                      {job.error.backtrace.join('\n')}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
    </li>
  );
}
