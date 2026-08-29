import { humanizeStatusCode } from '../../../../../../shared/candidateProfile/formatting';
import type { CandidateProfile, CandidateProfileError } from '../../../../lib/candidate-profile-client';
import { CANDIDATE_PROFILE_ERROR_KEYS } from '../../../../../../shared/candidateProfile/errorMessages';
import { APPLICATION_SUBMISSION_STATE_KEYS, APPLICATION_SUBMISSION_STATE_TONES } from '../../../../../../shared/applicationProgress/statusLabels';
import { CANDIDATE_DOCUMENT_STATUS_KEYS } from '../../../../../../shared/candidateDocuments/statusLabels';
import type { ApplicationProgressDocuments } from '../../../../../../shared/applicationProgress/types';
import {
  Badge,
  Card,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  SessionExpiredState,
} from '../../../../design-system';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';

export interface CandidateProfileViewProps {
  isLoading: boolean;
  error: CandidateProfileError | null;
  profile: CandidateProfile | undefined;
  /**
   * The candidate's own document-verification aggregate, from the same
   * application-progress endpoint the dashboard/documents pages already
   * use -- composed in here (not re-fetched) so the profile page shows the
   * real, backend-computed `submissionState` as its verified indicator
   * rather than inferring one from individual document badges (ticket: "Do
   * not infer candidate verification merely because all visible document
   * badges happen to be green."). Undefined while progress hasn't loaded
   * yet -- the section is simply omitted rather than shown empty/wrong.
   */
  documents?: ApplicationProgressDocuments;
  t: (key: TranslationKey) => string;
  onRetry: () => void;
  /** Signs the candidate out and returns them to sign-in -- used by the session-expired/inactive-account actions. */
  onReturnToSignIn: () => void;
}

const DOCUMENT_COUNT_ROWS = [
  ['missing', 'missing'],
  ['pending_review', 'pendingReview'],
  ['verified', 'verified'],
  ['rejected', 'rejected'],
] as const;

/**
 * Renders the candidate self-profile per the ticket's required UI states:
 * loading, success (approved safe fields only), session-expired, inactive
 * account, offline, and a generic retryable error for everything else
 * (rate-limited/server/network/unknown).
 */
export function CandidateProfileView({
  isLoading,
  error,
  profile,
  documents,
  t,
  onRetry,
  onReturnToSignIn,
}: CandidateProfileViewProps) {
  if (isLoading) {
    return <LoadingState message={t('loading')} />;
  }

  if (error?.code === 'SESSION_EXPIRED') {
    return (
      <SessionExpiredState
        title={t('dsSessionExpiredTitle')}
        description={t('dsSessionExpiredDescription')}
        actionLabel={t('dsSessionExpiredAction')}
        onAction={onReturnToSignIn}
      />
    );
  }

  if (error?.code === 'INACTIVE_ACCOUNT') {
    return (
      <ForbiddenState
        title={t('candidateProfileInactiveAccountTitle')}
        description={t('candidateProfileInactiveAccountDescription')}
        actionLabel={t('candidateProfileInactiveAccountAction')}
        onAction={onReturnToSignIn}
      />
    );
  }

  if (error?.code === 'FORBIDDEN') {
    return <ForbiddenState title={t('dsForbiddenTitle')} description={t('dsForbiddenDescription')} />;
  }

  if (error?.code === 'OFFLINE') {
    return (
      <OfflineState title={t('dsOfflineTitle')} description={t('dsOfflineDescription')} retryLabel={t('retry')} onRetry={onRetry} />
    );
  }

  if (error) {
    const key = CANDIDATE_PROFILE_ERROR_KEYS[error.code] as TranslationKey;
    return <ErrorState message={t(key)} retryLabel={t('retry')} onRetry={onRetry} />;
  }

  if (!profile) {
    return <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={onRetry} />;
  }

  // `isIdentifier` rows render with a forced LTR direction: a masked CNIC
  // (mostly digits/dashes) has no Latin anchor character, so the browser's
  // bidi algorithm reverses its visual digit order under Urdu's RTL layout
  // -- same reason CnicField.tsx forces `dir: 'ltr'` on the *input* version
  // of a CNIC. The reference number is defensively marked the same way even
  // though its leading letters already anchor it as LTR today -- but only
  // when it has a real value; the "not assigned yet" fallback is ordinary
  // prose and must follow the page's normal direction, not force-LTR.
  const notAssignedYet = t('candidateProfileNotAssignedYet');
  const infoRows: Array<{ labelKey: TranslationKey; value: string; isIdentifier?: boolean }> = [
    { labelKey: 'candidateProfileMaskedCnicLabel', value: profile.maskedCnic, isIdentifier: true },
    profile.referenceNumber
      ? { labelKey: 'candidateProfileReferenceNumberLabel', value: profile.referenceNumber, isIdentifier: true }
      : { labelKey: 'candidateProfileReferenceNumberLabel', value: notAssignedYet },
    {
      labelKey: 'candidateProfilePreferredLocaleLabel',
      value: profile.preferredLocale === 'ur' ? t('urduLabel') : t('englishLabel'),
    },
    { labelKey: 'candidateProfileStatusLabel', value: humanizeStatusCode(profile.candidateStatus) },
    {
      labelKey: 'candidateProfileWorkflowStageLabel',
      value: profile.currentWorkflowStage?.name ?? notAssignedYet,
    },
  ];

  return (
    <>
      <Card className="mb-5 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0066CC] text-3xl font-semibold text-white">
          {profile.fullName.charAt(0)}
        </div>
        <div className="text-xl font-semibold text-text-primary">{profile.fullName}</div>
        <div className="mt-1 text-sm text-text-secondary">{profile.referenceNumber ?? notAssignedYet}</div>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('personalInfo')}</h2>
        <dl>
          {infoRows.map((row) => (
            <div key={row.labelKey} className="flex items-start justify-between border-b border-border py-4 last:border-b-0">
              <dt className="text-sm text-text-secondary">{t(row.labelKey)}</dt>
              <dd
                className="max-w-[70%] text-end text-sm font-medium text-text-primary"
                dir={row.isIdentifier ? 'ltr' : undefined}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {documents ? (
        <Card className="mb-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-text-primary">{t('candidateProfileDocumentsSectionTitle')}</h2>
            <Badge tone={APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState]}>
              {t(APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState] as TranslationKey)}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4">
            {DOCUMENT_COUNT_ROWS.map(([status, field]) => (
              <div key={status} className="min-w-[90px]">
                <div className="text-xs text-text-secondary">{t(CANDIDATE_DOCUMENT_STATUS_KEYS[status] as TranslationKey)}</div>
                <div className="text-base font-medium text-text-primary">{documents[field]}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
