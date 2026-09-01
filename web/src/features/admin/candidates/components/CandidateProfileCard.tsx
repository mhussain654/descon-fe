import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CnicField,
  ConfirmDialog,
  ErrorState,
  ForbiddenState,
  Input,
  LoadingState,
  OfflineState,
  Select,
  ValidationMessage,
} from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { useStaffAuth } from '../../../../contexts/StaffAuthContext';
import { normalizeMobileNumber, isValidMobileNumber } from '../../../../../../shared/adminCandidates/mobileNumber';
import { normalizePassportNumber, isValidPassportNumber } from '../../../../../../shared/adminCandidates/passportNumber';
import { isNextOfKinStarted } from '../../../../../../shared/adminCandidates/nextOfKin';
import { formatCnic, isValidCnic, toCnicDigits } from '../../../../../../shared/cnic';
import { ADMIN_CANDIDATE_ERROR_KEYS } from '../../../../../../shared/adminCandidates/errorMessages';
import type { AdminCandidateDetail } from '../../../../lib/admin-candidates-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCandidateDetail } from '../hooks/useCandidateDetail';
import { useUpdateCandidateProfile, type UpdateCandidateFormValues } from '../hooks/useUpdateCandidateProfile';
import { useCountries, useCrafts, useProjects } from '../hooks/useReferenceData';

const FIELD_ERROR_MAP: Record<string, string> = {
  full_name: 'fullName',
  mobile_number: 'mobileNumber',
  passport_number: 'passportNumber',
  next_of_kin_name: 'nextOfKinName',
  next_of_kin_relationship: 'nextOfKinRelationship',
  next_of_kin_mobile_number: 'nextOfKinMobileNumber',
  next_of_kin_cnic: 'nextOfKinCnicDigits',
  preferred_locale: 'preferredLocale',
  country_code: 'countryCode',
  project_code: 'projectCode',
  craft_code: 'craftCode',
};

export interface CandidateProfileCardProps {
  candidateId: string;
}

export function CandidateProfileCard({ candidateId }: CandidateProfileCardProps) {
  const { t } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const canManage = hasPermission('manage_candidates');

  const detailQuery = useCandidateDetail(candidateId);
  const update = useUpdateCandidateProfile(candidateId);

  useEffect(() => {
    const code = detailQuery.error?.code ?? update.mutation.error?.code;
    if (code === 'SESSION_EXPIRED' || code === 'INACTIVE_ACCOUNT') {
      signOut(code === 'SESSION_EXPIRED' ? 'expired' : 'manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.error, update.mutation.error, signOut]);

  if (detailQuery.isLoading) {
    return (
      <Card>
        <LoadingState message={t('loading')} />
      </Card>
    );
  }

  if (detailQuery.error?.code === 'SESSION_EXPIRED' || detailQuery.error?.code === 'INACTIVE_ACCOUNT') {
    return null;
  }

  if (detailQuery.error?.code === 'FORBIDDEN') {
    return (
      <Card>
        <ForbiddenState title={t('dsForbiddenTitle')} description={t('staffAuthForbiddenError')} />
      </Card>
    );
  }

  if (detailQuery.error?.code === 'OFFLINE') {
    return (
      <Card>
        <OfflineState
          title={t('dsOfflineTitle')}
          description={t('dsOfflineDescription')}
          retryLabel={t('retry')}
          onRetry={() => detailQuery.refetch()}
        />
      </Card>
    );
  }

  if (detailQuery.error) {
    const messageKey = ADMIN_CANDIDATE_ERROR_KEYS[detailQuery.error.code] as TranslationKey;
    return (
      <Card>
        <ErrorState
          message={detailQuery.error.message || t(messageKey)}
          retryLabel={t('retry')}
          onRetry={() => detailQuery.refetch()}
        />
      </Card>
    );
  }

  if (!detailQuery.data) {
    return (
      <Card>
        <ErrorState message={t('somethingWentWrong')} retryLabel={t('retry')} onRetry={() => detailQuery.refetch()} />
      </Card>
    );
  }

  return <CandidateProfileCardBody candidate={detailQuery.data} canManage={canManage} update={update} />;
}

interface CandidateProfileCardBodyProps {
  candidate: AdminCandidateDetail;
  canManage: boolean;
  update: ReturnType<typeof useUpdateCandidateProfile>;
}

function CandidateProfileCardBody({ candidate, canManage, update }: CandidateProfileCardBodyProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);

  const canEditAssignmentFields = candidate.assignment?.fieldsEditable ?? false;

  if (!isEditing) {
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{t('personalInfo')}</h2>
          {canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              {t('adminCandidateEditAction')}
            </Button>
          ) : null}
        </div>

        {update.staleNotice ? (
          <div className="mb-4 flex items-center gap-3">
            <ValidationMessage tone="error">{t('adminCandidateStaleError')}</ValidationMessage>
            <Button type="button" variant="text" size="sm" onClick={update.refresh}>
              {t('adminCandidateStaleRefreshAction')}
            </Button>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('adminCandidateFullNameLabel')} value={candidate.fullName} />
          <Field label={t('cnicShort')} value={candidate.cnic} dir="ltr" />
          <Field label={t('adminCandidateMobileNumberLabel')} value={candidate.mobileNumber} dir="ltr" />
          <Field label={t('adminCandidatePassportNumberLabel')} value={candidate.passportNumber || t('notAvailable')} dir="ltr" />
          <Field
            label={t('adminCandidatePreferredLocaleLabel')}
            value={candidate.preferredLocale === 'ur' ? t('urduLabel') : t('englishLabel')}
          />
          <Field label={t('adminCandidateReferenceNumberLabel')} value={candidate.assignment?.referenceNumber ?? t('notAvailable')} dir="ltr" />
          <Field label={t('adminCandidateCountryLabel')} value={candidate.assignment?.country.name ?? t('notAvailable')} />
          <Field label={t('adminCandidateProjectLabel')} value={candidate.assignment?.project.name ?? t('notAvailable')} />
          <Field label={t('adminCandidateCraftLabel')} value={candidate.assignment?.craft.name ?? t('notAvailable')} />
          <div>
            <dt className="text-xs text-text-tertiary">{t('adminWorkflowCurrentStageLabel')}</dt>
            <dd className="mt-1">
              <Badge tone="info">{candidate.assignment?.currentWorkflowStage.name ?? t('notAvailable')}</Badge>
            </dd>
          </div>
        </dl>

        {candidate.nextOfKin.name ? (
          <div className="mt-6 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateNextOfKinSectionTitle')}</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('adminCandidateNextOfKinNameLabel')} value={candidate.nextOfKin.name} />
              <Field label={t('adminCandidateNextOfKinRelationshipLabel')} value={candidate.nextOfKin.relationship ?? t('notAvailable')} />
              <Field label={t('adminCandidateNextOfKinMobileNumberLabel')} value={candidate.nextOfKin.mobileNumber ?? t('notAvailable')} dir="ltr" />
              <Field label={t('adminCandidateNextOfKinCnicLabel')} value={candidate.nextOfKin.cnic ?? t('notAvailable')} dir="ltr" />
            </dl>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <CandidateProfileEditForm
      candidate={candidate}
      canEditAssignmentFields={canEditAssignmentFields}
      update={update}
      onDone={() => setIsEditing(false)}
    />
  );
}

function Field({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-text-primary" dir={dir}>
        {value}
      </dd>
    </div>
  );
}

interface CandidateProfileEditFormProps {
  candidate: AdminCandidateDetail;
  canEditAssignmentFields: boolean;
  update: ReturnType<typeof useUpdateCandidateProfile>;
  onDone: () => void;
}

function CandidateProfileEditForm({ candidate, canEditAssignmentFields, update, onDone }: CandidateProfileEditFormProps) {
  const { t } = useLanguage();
  const countriesQuery = useCountries();
  const projectsQuery = useProjects();
  const craftsQuery = useCrafts();

  const [fullName, setFullName] = useState(candidate.fullName);
  const [mobileNumber, setMobileNumber] = useState(candidate.mobileNumber);
  const [passportNumber, setPassportNumber] = useState(candidate.passportNumber ?? '');
  const [nextOfKinName, setNextOfKinName] = useState(candidate.nextOfKin.name ?? '');
  const [nextOfKinRelationship, setNextOfKinRelationship] = useState(candidate.nextOfKin.relationship ?? '');
  const [nextOfKinMobileNumber, setNextOfKinMobileNumber] = useState(candidate.nextOfKin.mobileNumber ?? '');
  const [nextOfKinCnicDigits, setNextOfKinCnicDigits] = useState(toCnicDigits(candidate.nextOfKin.cnic ?? ''));
  const [preferredLocale, setPreferredLocale] = useState<'en' | 'ur'>(candidate.preferredLocale);
  const [countryCode, setCountryCode] = useState(candidate.assignment?.country.code ?? '');
  const [projectCode, setProjectCode] = useState(candidate.assignment?.project.code ?? '');
  const [craftCode, setCraftCode] = useState(candidate.assignment?.craft.code ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmingMobileChange, setConfirmingMobileChange] = useState(false);

  const mutationError = update.mutation.error;
  const mappedField = mutationError?.field ? FIELD_ERROR_MAP[mutationError.field] : undefined;
  const backendMessage = mutationError
    ? mutationError.message || t(ADMIN_CANDIDATE_ERROR_KEYS[mutationError.code] as TranslationKey)
    : undefined;
  const nonFieldError = mutationError && !mappedField ? backendMessage : undefined;

  const errorFor = (field: string): string | undefined =>
    fieldErrors[field] ?? (mappedField === field ? backendMessage : undefined);

  const buildValues = (): UpdateCandidateFormValues => {
    const values: UpdateCandidateFormValues = {};
    if (fullName.trim() !== candidate.fullName) values.fullName = fullName.trim();
    const normalizedMobile = normalizeMobileNumber(mobileNumber);
    if (normalizedMobile !== candidate.mobileNumber) values.mobileNumber = normalizedMobile;
    const normalizedPassport = normalizePassportNumber(passportNumber);
    if (normalizedPassport !== (candidate.passportNumber ?? '')) values.passportNumber = normalizedPassport;

    const normalizedNextOfKin = {
      name: nextOfKinName.trim(),
      relationship: nextOfKinRelationship.trim(),
      mobileNumber: normalizeMobileNumber(nextOfKinMobileNumber),
      cnic: formatCnic(nextOfKinCnicDigits),
    };
    const originalNextOfKin = {
      name: candidate.nextOfKin.name ?? '',
      relationship: candidate.nextOfKin.relationship ?? '',
      mobileNumber: candidate.nextOfKin.mobileNumber ?? '',
      cnic: candidate.nextOfKin.cnic ?? '',
    };
    const nextOfKinChanged = (Object.keys(normalizedNextOfKin) as (keyof typeof normalizedNextOfKin)[]).some(
      (key) => normalizedNextOfKin[key] !== originalNextOfKin[key]
    );
    if (nextOfKinChanged) values.nextOfKin = normalizedNextOfKin;

    if (preferredLocale !== candidate.preferredLocale) values.preferredLocale = preferredLocale;
    if (canEditAssignmentFields) {
      if (countryCode !== (candidate.assignment?.country.code ?? '')) values.countryCode = countryCode;
      if (projectCode !== (candidate.assignment?.project.code ?? '')) values.projectCode = projectCode;
      if (craftCode !== (candidate.assignment?.craft.code ?? '')) values.craftCode = craftCode;
    }
    return values;
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = t('adminCandidateFullNameRequiredError');
    if (!isValidMobileNumber(normalizeMobileNumber(mobileNumber))) errors.mobileNumber = t('adminCandidateMobileNumberInvalidError');
    if (!isValidPassportNumber(normalizePassportNumber(passportNumber))) errors.passportNumber = t('adminCandidatePassportNumberInvalidError');
    if (
      isNextOfKinStarted({
        name: nextOfKinName,
        relationship: nextOfKinRelationship,
        mobileNumber: nextOfKinMobileNumber,
        cnic: nextOfKinCnicDigits,
      })
    ) {
      if (!nextOfKinName.trim()) errors.nextOfKinName = t('adminCandidateNextOfKinFieldRequiredError');
      if (!nextOfKinRelationship.trim()) errors.nextOfKinRelationship = t('adminCandidateNextOfKinFieldRequiredError');
      if (!isValidMobileNumber(normalizeMobileNumber(nextOfKinMobileNumber))) {
        errors.nextOfKinMobileNumber = t('adminCandidateNextOfKinMobileNumberInvalidError');
      }
      if (!isValidCnic(nextOfKinCnicDigits)) errors.nextOfKinCnicDigits = t('adminCandidateNextOfKinCnicInvalidError');
    }
    if (canEditAssignmentFields) {
      if (!countryCode) errors.countryCode = t('adminCandidateCountryRequiredError');
      if (!projectCode) errors.projectCode = t('adminCandidateProjectRequiredError');
      if (!craftCode) errors.craftCode = t('adminCandidateCraftRequiredError');
    }
    return errors;
  };

  const performSubmit = () => {
    const values = buildValues();
    if (Object.keys(values).length === 0) {
      onDone();
      return;
    }
    update.submit(values, candidate.updatedAt ?? undefined);
  };

  const handleSave = () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Changing the candidate's stored mobile number changes where their own
    // sign-in verification code is delivered -- confirm before submitting
    // (ticket: "Confirm sensitive changes where appropriate").
    if (normalizeMobileNumber(mobileNumber) !== candidate.mobileNumber) {
      setConfirmingMobileChange(true);
      return;
    }
    performSubmit();
  };

  useEffect(() => {
    // A stale conflict means the record actually changed underneath this
    // form -- continuing to edit against what's now outdated data risks
    // another conflict, so this closes the form back to the read view,
    // where the stale notice and its Refresh action are shown against the
    // freshly-invalidated detail, rather than leaving the form open on
    // values that no longer reflect reality.
    if (update.mutation.isSuccess || update.staleNotice) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update.mutation.isSuccess, update.staleNotice]);

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminCandidateEditAction')}</h2>
      <div className="space-y-4">
        <Input
          label={t('adminCandidateFullNameLabel')}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          errorMessage={errorFor('fullName')}
        />
        <Input
          label={t('adminCandidateMobileNumberLabel')}
          helperText={t('adminCandidateMobileNumberHelper')}
          type="tel"
          dir="ltr"
          value={mobileNumber}
          onChange={(event) => setMobileNumber(event.target.value)}
          errorMessage={errorFor('mobileNumber')}
        />
        <Input
          label={t('adminCandidatePassportNumberLabel')}
          requirementText={t('dsOptionalField')}
          dir="ltr"
          value={passportNumber}
          onChange={(event) => setPassportNumber(event.target.value)}
          errorMessage={errorFor('passportNumber')}
        />

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateNextOfKinSectionTitle')}</h3>
          <div className="space-y-4">
            <Input
              label={t('adminCandidateNextOfKinNameLabel')}
              requirementText={t('dsOptionalField')}
              value={nextOfKinName}
              onChange={(event) => setNextOfKinName(event.target.value)}
              errorMessage={errorFor('nextOfKinName')}
            />
            <Input
              label={t('adminCandidateNextOfKinRelationshipLabel')}
              requirementText={t('dsOptionalField')}
              value={nextOfKinRelationship}
              onChange={(event) => setNextOfKinRelationship(event.target.value)}
              errorMessage={errorFor('nextOfKinRelationship')}
            />
            <Input
              label={t('adminCandidateNextOfKinMobileNumberLabel')}
              requirementText={t('dsOptionalField')}
              type="tel"
              dir="ltr"
              value={nextOfKinMobileNumber}
              onChange={(event) => setNextOfKinMobileNumber(event.target.value)}
              errorMessage={errorFor('nextOfKinMobileNumber')}
            />
            <CnicField
              label={t('adminCandidateNextOfKinCnicLabel')}
              requirementText={t('dsOptionalField')}
              value={nextOfKinCnicDigits}
              onValueChange={setNextOfKinCnicDigits}
              errorMessage={errorFor('nextOfKinCnicDigits')}
            />
          </div>
        </div>

        <Select
          label={t('adminCandidatePreferredLocaleLabel')}
          value={preferredLocale}
          onChange={(event) => setPreferredLocale(event.target.value as 'en' | 'ur')}
          options={[
            { value: 'en', label: t('englishLabel') },
            { value: 'ur', label: t('urduLabel') },
          ]}
        />

        {canEditAssignmentFields ? (
          <>
            <ReferenceSelect
              label={t('adminCandidateCountryLabel')}
              query={countriesQuery}
              value={countryCode}
              onChange={setCountryCode}
              errorMessage={errorFor('countryCode')}
            />
            <ReferenceSelect
              label={t('adminCandidateProjectLabel')}
              query={projectsQuery}
              value={projectCode}
              onChange={setProjectCode}
              errorMessage={errorFor('projectCode')}
            />
            <ReferenceSelect
              label={t('adminCandidateCraftLabel')}
              query={craftsQuery}
              value={craftCode}
              onChange={setCraftCode}
              errorMessage={errorFor('craftCode')}
            />
          </>
        ) : (
          <p className="text-xs text-text-tertiary">{t('adminCandidateAssignmentFieldsLockedNotice')}</p>
        )}

        {nonFieldError ? <ValidationMessage tone="error">{nonFieldError}</ValidationMessage> : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={update.mutation.isPending}>
            {t('dsDialogCancel')}
          </Button>
          <Button type="button" onClick={handleSave} loading={update.mutation.isPending} disabled={update.mutation.isPending}>
            {t('adminCandidateSaveAction')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingMobileChange}
        onOpenChange={(open) => (!open ? setConfirmingMobileChange(false) : undefined)}
        title={t('adminCandidateConfirmMobileChangeTitle')}
        description={t('adminCandidateConfirmMobileChangeDescription')}
        confirmLabel={t('adminCandidateSaveAction')}
        cancelLabel={t('dsDialogCancel')}
        closeLabel={t('dsClose')}
        onConfirm={() => {
          setConfirmingMobileChange(false);
          performSubmit();
        }}
        isConfirming={update.mutation.isPending}
      />
    </Card>
  );
}

interface ReferenceSelectProps {
  label: string;
  query: ReturnType<typeof useCountries>;
  value: string;
  onChange: (value: string) => void;
  errorMessage: string | undefined;
}

function ReferenceSelect({ label, query, value, onChange, errorMessage }: ReferenceSelectProps) {
  const { t } = useLanguage();

  if (query.isLoading) {
    return <Select label={label} value="" disabled options={[{ value: '', label: t('loading') }]} />;
  }

  if (query.error) {
    const messageKey = ADMIN_CANDIDATE_ERROR_KEYS[query.error.code] as TranslationKey;
    return (
      <div>
        <Select label={label} value="" disabled options={[{ value: '', label: '' }]} />
        <div className="mt-2 flex items-center gap-3">
          <ValidationMessage tone="error">{query.error.message || t(messageKey)}</ValidationMessage>
          <Button type="button" variant="text" size="sm" onClick={() => query.refetch()}>
            {t('retry')}
          </Button>
        </div>
      </div>
    );
  }

  const items = query.data ?? [];
  return (
    <Select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      errorMessage={errorMessage}
      options={[{ value: '', label: '' }, ...items.map((item) => ({ value: item.code, label: item.name }))]}
    />
  );
}
