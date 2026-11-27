import { translations } from '../i18n/translations';
import { ORDERED_WORKFLOW_STAGE_CODES } from '../adminCandidates/workflowStageLabels';
import { currentStageGuidanceKey, transitionGuidanceKey } from './staffGuidance';

describe('currentStageGuidanceKey', () => {
  it('has English and Urdu guidance for every stage a candidate can be at', () => {
    ORDERED_WORKFLOW_STAGE_CODES.forEach((code) => {
      const key = currentStageGuidanceKey(code);
      expect(key).toBeTruthy();
      expect(translations.en[key!]).toBeTruthy();
      expect(translations.ur[key!]).toBeTruthy();
    });
  });

  it('says to wait for the agent while the E-Number is requested', () => {
    expect(translations.en[currentStageGuidanceKey('e_number_requested')!]).toMatch(/Waiting for the agent/);
  });

  it('shows nothing for an unknown or missing stage', () => {
    expect(currentStageGuidanceKey('not_a_stage')).toBeUndefined();
    expect(currentStageGuidanceKey(undefined)).toBeUndefined();
  });
});

describe('transitionGuidanceKey', () => {
  it('explains what completing a stage means', () => {
    expect(translations.en[transitionGuidanceKey('e_number_requested')]).toMatch(/sent them to the agent/);
  });

  it('falls back to the generic description for a stage without its own', () => {
    expect(transitionGuidanceKey('campaign_nomination')).toBe('adminWorkflowGenericTransitionDescription');
  });
});
