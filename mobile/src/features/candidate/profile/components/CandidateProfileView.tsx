import { StyleSheet, Text, View } from 'react-native';
import { humanizeStatusCode } from '../../../../../../shared/candidateProfile/formatting';
import { CANDIDATE_PROFILE_ERROR_KEYS } from '../../../../../../shared/candidateProfile/errorMessages';
import { APPLICATION_SUBMISSION_STATE_KEYS, APPLICATION_SUBMISSION_STATE_TONES } from '../../../../../../shared/applicationProgress/statusLabels';
import { CANDIDATE_DOCUMENT_STATUS_KEYS } from '../../../../../../shared/candidateDocuments/statusLabels';
import type { ApplicationProgressDocuments } from '../../../../../../shared/applicationProgress/types';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import type { CandidateProfile, CandidateProfileError } from '../../../../lib/candidate-profile-client';
import {
  Badge,
  Card,
  ErrorState,
  ForbiddenState,
  LoadingState,
  OfflineState,
  SessionExpiredState,
} from '../../../../design-system';
import { colors, fontWeights, spacing } from '../../../../design-system/tokens';

export interface CandidateProfileViewProps {
  isLoading: boolean;
  error: CandidateProfileError | null;
  profile: CandidateProfile | undefined;
  /**
   * The candidate's own document-verification aggregate, from the same
   * application-progress endpoint the dashboard/documents screens already
   * use -- composed in here (not re-fetched) so the profile screen shows
   * the real, backend-computed `submissionState` as its verified indicator
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

/** Mirrors web/src/features/candidate/profile/components/CandidateProfileView.tsx exactly (AGENTS.md: "Web and mobile candidate experiences must share the same ... loading, empty, error, offline and retry scenarios"). */
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

  // `isIdentifier` rows render with a forced LTR writing direction -- see
  // web/src/features/candidate/profile/components/CandidateProfileView.tsx's
  // identical comment (same underlying bidi behavior applies on RN). Only
  // applied when there's a real value -- the "not assigned yet" fallback is
  // ordinary prose and must follow the page's normal writing direction.
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
      <Card style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{profile.fullName.charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{profile.fullName}</Text>
        <Text style={styles.referenceNumber}>{profile.referenceNumber ?? notAssignedYet}</Text>
      </Card>

      <Card style={styles.infoCard}>
        <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
        {infoRows.map((row) => (
          <View key={row.labelKey} style={styles.row}>
            <Text style={styles.rowLabel}>{t(row.labelKey)}</Text>
            <Text style={[styles.rowValue, row.isIdentifier && styles.rowValueLtr]}>{row.value}</Text>
          </View>
        ))}
      </Card>

      {documents ? (
        <Card style={styles.infoCard}>
          <View style={styles.documentsHeader}>
            <Text style={styles.sectionTitle}>{t('candidateProfileDocumentsSectionTitle')}</Text>
            <Badge tone={APPLICATION_SUBMISSION_STATE_TONES[documents.submissionState]}>
              {t(APPLICATION_SUBMISSION_STATE_KEYS[documents.submissionState] as TranslationKey)}
            </Badge>
          </View>
          <View style={styles.documentCounts}>
            {DOCUMENT_COUNT_ROWS.map(([status, field]) => (
              <View key={status} style={styles.countItem}>
                <Text style={styles.countLabel}>{t(CANDIDATE_DOCUMENT_STATUS_KEYS[status] as TranslationKey)}</Text>
                <Text style={styles.countValue}>{documents[field]}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing[5], alignItems: 'center' },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brand.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  avatarInitial: { fontSize: 32, fontWeight: fontWeights.semibold, color: '#FFFFFF' },
  name: { fontSize: 20, fontWeight: fontWeights.semibold, color: colors.text.primary },
  referenceNumber: { marginTop: spacing[1], fontSize: 14, color: colors.text.secondary },
  infoCard: { marginBottom: spacing[5] },
  sectionTitle: { marginBottom: spacing[4], fontSize: 16, fontWeight: fontWeights.semibold, color: colors.text.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowLabel: { fontSize: 14, color: colors.text.secondary },
  // No explicit textAlign -- RN mirrors `flexDirection: 'row'` under
  // I18nManager's forced RTL (see LanguageContext.jsx), so an explicit
  // 'right' here would stay literally right instead of following that flip
  // (the same reason CnicField.tsx has to force 'left' to *resist* it).
  rowValue: { maxWidth: '60%', fontSize: 14, fontWeight: fontWeights.medium, color: colors.text.primary },
  rowValueLtr: { writingDirection: 'ltr' },
  documentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[4], gap: spacing[2] },
  documentCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  countItem: { minWidth: 90 },
  countLabel: { fontSize: 12, color: colors.text.secondary },
  countValue: { fontSize: 16, fontWeight: fontWeights.medium, color: colors.text.primary },
});
