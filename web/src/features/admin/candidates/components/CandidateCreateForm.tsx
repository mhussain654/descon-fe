import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  Card,
  CnicField,
  EmptyState,
  Input,
  Select,
  ValidationMessage,
} from '../../../../design-system';
import { useLanguage } from '../../../../contexts/LanguageContext';
import { formatCnic, isValidCnic, toCnicDigits } from '../../../../../../shared/cnic';
import { isValidRegistrationNumber } from '../../../../../../shared/adminCandidates/registrationNumber';
import { normalizeMobileNumber, isValidMobileNumber } from '../../../../../../shared/adminCandidates/mobileNumber';
import { normalizePassportNumber, isValidPassportNumber } from '../../../../../../shared/adminCandidates/passportNumber';
import { isNextOfKinStarted } from '../../../../../../shared/adminCandidates/nextOfKin';
import { ADMIN_CANDIDATE_ERROR_KEYS } from '../../../../../../shared/adminCandidates/errorMessages';
import type { ReferenceDataItem } from '../../../../lib/admin-candidates-client';
import type { TranslationKey } from '../../../../../../shared/i18n/translations';
import { useCreateCandidate, type CreateCandidateFormValues } from '../hooks/useCreateCandidate';
import { useCountries, useCrafts, useProjects } from '../hooks/useReferenceData';
import { CampaignSelectField } from '../../campaigns/components/CampaignSelectField';
import { useDefaultCampaign } from '../../campaigns/hooks/useCampaigns';
import type { Campaign } from '../../../../lib/admin-campaigns-client';

type ReferenceDataQuery = ReturnType<typeof useCountries>;

/** Maps the backend's snake_case field name (candidate.full_name, candidate.cnic, ...) to this form's own field key. */
const FIELD_ERROR_MAP: Record<string, keyof FormState> = {
  full_name: 'fullName',
  cnic: 'cnic',
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
  registration_number: 'registrationNumber',
  campaign_id: 'campaignId',
};

interface FormState {
  fullName: string;
  cnicDigits: string;
  mobileNumber: string;
  passportNumber: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinMobileNumber: string;
  nextOfKinCnicDigits: string;
  preferredLocale: 'en' | 'ur';
  countryCode: string;
  projectCode: string;
  craftCode: string;
  registrationNumber: string;
  campaignId: string;
  /** The picked campaign's country: when set, the country field follows it. */
  campaignCountryCode: string;
}

const INITIAL_STATE: FormState = {
  fullName: '',
  cnicDigits: '',
  mobileNumber: '',
  passportNumber: '',
  nextOfKinName: '',
  nextOfKinRelationship: '',
  nextOfKinMobileNumber: '',
  nextOfKinCnicDigits: '',
  preferredLocale: 'en',
  countryCode: '',
  projectCode: '',
  craftCode: '',
  registrationNumber: '',
  campaignId: '',
  campaignCountryCode: '',
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export function CandidateCreateForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const countriesQuery = useCountries();
  const projectsQuery = useProjects();
  const craftsQuery = useCrafts();
  const defaultCampaign = useDefaultCampaign();
  const prefilledCampaign = useRef(false);

  // A picked campaign fixes the country (the Test campaign leaves it free).
  const pickCampaign = (campaign: Campaign | null) => {
    setForm((current) => ({
      ...current,
      campaignId: campaign?.id ?? '',
      campaignCountryCode: campaign?.country?.code ?? '',
      countryCode: campaign?.country?.code ?? current.countryCode,
    }));
    setFieldErrors((current) => ({ ...current, campaignId: undefined, countryCode: undefined }));
  };

  // Start from the running campaign (else the latest one); staff can still pick another.
  useEffect(() => {
    if (prefilledCampaign.current || defaultCampaign === undefined) return;
    prefilledCampaign.current = true;
    if (defaultCampaign) pickCampaign(defaultCampaign);
  }, [defaultCampaign]);

  const { submit, mutation } = useCreateCandidate({
    onSuccess: (candidate) => navigate(`/admin/candidates/${candidate.id}`),
  });

  const mutationError = mutation.error;
  const mappedErrorField = mutationError?.field ? FIELD_ERROR_MAP[mutationError.field] : undefined;
  const nonFieldError =
    mutationError && !mappedErrorField
      ? mutationError.message || t(ADMIN_CANDIDATE_ERROR_KEYS[mutationError.code] as TranslationKey)
      : undefined;
  const backendFieldErrors: FieldErrors = mappedErrorField
    ? { [mappedErrorField]: mutationError!.message || t(ADMIN_CANDIDATE_ERROR_KEYS[mutationError!.code] as TranslationKey) }
    : {};

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!form.fullName.trim()) errors.fullName = t('adminCandidateFullNameRequiredError');
    if (!isValidCnic(form.cnicDigits)) errors.cnic = t('adminCandidateCnicInvalidError');

    const normalizedMobile = normalizeMobileNumber(form.mobileNumber);
    if (!isValidMobileNumber(normalizedMobile)) errors.mobileNumber = t('adminCandidateMobileNumberInvalidError');

    const normalizedPassport = normalizePassportNumber(form.passportNumber);
    if (!isValidPassportNumber(normalizedPassport)) errors.passportNumber = t('adminCandidatePassportNumberInvalidError');

    if (
      isNextOfKinStarted({
        name: form.nextOfKinName,
        relationship: form.nextOfKinRelationship,
        mobileNumber: form.nextOfKinMobileNumber,
        cnic: form.nextOfKinCnicDigits,
      })
    ) {
      if (!form.nextOfKinName.trim()) errors.nextOfKinName = t('adminCandidateNextOfKinFieldRequiredError');
      if (!form.nextOfKinRelationship.trim()) errors.nextOfKinRelationship = t('adminCandidateNextOfKinFieldRequiredError');
      const normalizedNextOfKinMobile = normalizeMobileNumber(form.nextOfKinMobileNumber);
      if (!isValidMobileNumber(normalizedNextOfKinMobile)) errors.nextOfKinMobileNumber = t('adminCandidateNextOfKinMobileNumberInvalidError');
      if (!isValidCnic(form.nextOfKinCnicDigits)) errors.nextOfKinCnicDigits = t('adminCandidateNextOfKinCnicInvalidError');
    }

    if (!form.campaignId) errors.campaignId = t('adminCampaignRequiredError');
    if (!form.countryCode) errors.countryCode = t('adminCandidateCountryRequiredError');
    if (!form.projectCode) errors.projectCode = t('adminCandidateProjectRequiredError');
    if (!form.craftCode) errors.craftCode = t('adminCandidateCraftRequiredError');
    if (!isValidRegistrationNumber(form.registrationNumber)) errors.registrationNumber = t('adminCandidateRegistrationNumberInvalidError');

    return errors;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const nextOfKinStarted = isNextOfKinStarted({
      name: form.nextOfKinName,
      relationship: form.nextOfKinRelationship,
      mobileNumber: form.nextOfKinMobileNumber,
      cnic: form.nextOfKinCnicDigits,
    });

    const values: CreateCandidateFormValues = {
      fullName: form.fullName.trim(),
      cnic: formatCnic(form.cnicDigits),
      mobileNumber: normalizeMobileNumber(form.mobileNumber),
      passportNumber: normalizePassportNumber(form.passportNumber),
      ...(nextOfKinStarted
        ? {
            nextOfKin: {
              name: form.nextOfKinName.trim(),
              relationship: form.nextOfKinRelationship.trim(),
              mobileNumber: normalizeMobileNumber(form.nextOfKinMobileNumber),
              cnic: formatCnic(form.nextOfKinCnicDigits),
            },
          }
        : {}),
      preferredLocale: form.preferredLocale,
      countryCode: form.countryCode,
      projectCode: form.projectCode,
      craftCode: form.craftCode,
      registrationNumber: form.registrationNumber.trim(),
      campaignId: form.campaignId,
    };
    submit(values);
  };

  const errorFor = (field: keyof FormState): string | undefined => fieldErrors[field] ?? backendFieldErrors[field];

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('adminCandidateCreateTitle')}</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4">
          <Input
            label={t('adminCandidateFullNameLabel')}
            value={form.fullName}
            onChange={(event) => setField('fullName', event.target.value)}
            errorMessage={errorFor('fullName')}
            autoComplete="name"
          />
          <CnicField
            label={t('cnic')}
            value={form.cnicDigits}
            onValueChange={(digits) => setField('cnicDigits', digits)}
            errorMessage={errorFor('cnic')}
          />
          <Input
            label={t('adminCandidateMobileNumberLabel')}
            helperText={t('adminCandidateMobileNumberHelper')}
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={form.mobileNumber}
            onChange={(event) => setField('mobileNumber', event.target.value)}
            errorMessage={errorFor('mobileNumber')}
          />
          <Input
            label={t('adminCandidatePassportNumberLabel')}
            requirementText={t('dsOptionalField')}
            dir="ltr"
            value={form.passportNumber}
            onChange={(event) => setField('passportNumber', event.target.value)}
            errorMessage={errorFor('passportNumber')}
          />
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('adminCandidateNextOfKinSectionTitle')}</h3>
            <div className="space-y-4">
              <Input
                label={t('adminCandidateNextOfKinNameLabel')}
                requirementText={t('dsOptionalField')}
                value={form.nextOfKinName}
                onChange={(event) => setField('nextOfKinName', event.target.value)}
                errorMessage={errorFor('nextOfKinName')}
              />
              <Input
                label={t('adminCandidateNextOfKinRelationshipLabel')}
                requirementText={t('dsOptionalField')}
                value={form.nextOfKinRelationship}
                onChange={(event) => setField('nextOfKinRelationship', event.target.value)}
                errorMessage={errorFor('nextOfKinRelationship')}
              />
              <Input
                label={t('adminCandidateNextOfKinMobileNumberLabel')}
                requirementText={t('dsOptionalField')}
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={form.nextOfKinMobileNumber}
                onChange={(event) => setField('nextOfKinMobileNumber', event.target.value)}
                errorMessage={errorFor('nextOfKinMobileNumber')}
              />
              <CnicField
                label={t('adminCandidateNextOfKinCnicLabel')}
                requirementText={t('dsOptionalField')}
                value={form.nextOfKinCnicDigits}
                onValueChange={(digits) => setField('nextOfKinCnicDigits', digits)}
                errorMessage={errorFor('nextOfKinCnicDigits')}
              />
            </div>
          </div>
          <Select
            label={t('adminCandidatePreferredLocaleLabel')}
            value={form.preferredLocale}
            onChange={(event) => setField('preferredLocale', event.target.value as 'en' | 'ur')}
            options={[
              { value: 'en', label: t('englishLabel') },
              { value: 'ur', label: t('urduLabel') },
            ]}
          />
          <CampaignSelectField value={form.campaignId} onChange={pickCampaign} errorMessage={errorFor('campaignId')} />
          <ReferenceDataSelectField
            label={t('adminCandidateCountryLabel')}
            required
            query={countriesQuery}
            value={form.countryCode}
            onChange={(value) => setField('countryCode', value)}
            errorMessage={errorFor('countryCode')}
            emptyMessage={t('adminCandidateNoCountriesAvailable')}
            disabled={!!form.campaignCountryCode}
            helperText={form.campaignCountryCode ? t('adminCampaignCountryLocked') : undefined}
          />
          <ReferenceDataSelectField
            label={t('adminCandidateProjectLabel')}
            query={projectsQuery}
            value={form.projectCode}
            onChange={(value) => setField('projectCode', value)}
            errorMessage={errorFor('projectCode')}
            emptyMessage={t('adminCandidateNoProjectsAvailable')}
          />
          <ReferenceDataSelectField
            label={t('adminCandidateCraftLabel')}
            query={craftsQuery}
            value={form.craftCode}
            onChange={(value) => setField('craftCode', value)}
            errorMessage={errorFor('craftCode')}
            emptyMessage={t('adminCandidateNoCraftsAvailable')}
          />
          <Input
            label={t('adminCandidateRegistrationNumberLabel')}
            dir="ltr"
            inputMode="numeric"
            helperText={t('adminCandidateRegistrationNumberCreateHelp')}
            value={form.registrationNumber}
            onChange={(event) => setField('registrationNumber', event.target.value)}
            errorMessage={errorFor('registrationNumber')}
          />

          {nonFieldError ? <ValidationMessage tone="error">{nonFieldError}</ValidationMessage> : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/admin')} disabled={mutation.isPending}>
              {t('dsDialogCancel')}
            </Button>
            <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
              {t('adminCandidateCreateAction')}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

interface ReferenceDataSelectFieldProps {
  label: string;
  query: ReferenceDataQuery;
  value: string;
  onChange: (value: string) => void;
  errorMessage: string | undefined;
  emptyMessage: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

/**
 * One reference-data select (country/project/craft), each independently
 * reflecting its own query's loading/error/empty state -- a failure loading
 * crafts must not block the country and project fields the staff member can
 * otherwise complete (ticket: "Partial reference-data failure").
 */
function ReferenceDataSelectField({
  label,
  query,
  value,
  onChange,
  errorMessage,
  emptyMessage,
  required = false,
  disabled = false,
  helperText,
}: ReferenceDataSelectFieldProps) {
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

  const items: ReferenceDataItem[] = query.data ?? [];
  if (items.length === 0) {
    return (
      <div>
        <Select label={label} value="" disabled options={[{ value: '', label: '' }]} />
        <EmptyState title={emptyMessage} />
      </div>
    );
  }

  return (
    <Select
      label={label}
      required={required}
      requirementText={required ? t('dsRequiredField') : undefined}
      aria-label={required ? label : undefined}
      aria-required={required}
      value={value}
      disabled={disabled}
      helperText={errorMessage ? undefined : helperText}
      onChange={(event) => onChange(event.target.value)}
      errorMessage={errorMessage}
      options={[{ value: '', label: '' }, ...items.map((item) => ({ value: item.code, label: item.name }))]}
    />
  );
}
