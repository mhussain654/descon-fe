// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import {
  CANDIDATE_DOCUMENT_STATUS_KEYS,
  CANDIDATE_DOCUMENT_STATUS_TONES,
  PCC_COMPLIANCE_STATUS_KEYS,
  PCC_COMPLIANCE_STATUS_TONES,
} from './statusLabels';
import { translations } from '../i18n/translations';

describe('candidate document status -> translation key mapping', () => {
  it('maps every status, including the unknown fallback, to a real translated key', () => {
    for (const key of Object.values(CANDIDATE_DOCUMENT_STATUS_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });

  it('defines a visual tone for every status, including the unknown fallback', () => {
    for (const status of Object.keys(CANDIDATE_DOCUMENT_STATUS_KEYS)) {
      expect(CANDIDATE_DOCUMENT_STATUS_TONES).toHaveProperty(status);
    }
  });
});

describe('PCC compliance status -> translation key mapping', () => {
  it('maps every compliance status, including the unknown fallback, to a real translated key', () => {
    for (const key of Object.values(PCC_COMPLIANCE_STATUS_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });

  it('defines a visual tone for every compliance status, including the unknown fallback', () => {
    for (const status of Object.keys(PCC_COMPLIANCE_STATUS_KEYS)) {
      expect(PCC_COMPLIANCE_STATUS_TONES).toHaveProperty(status);
    }
  });

  it('keeps expired and near_expiry visually distinct from each other and from current', () => {
    expect(PCC_COMPLIANCE_STATUS_TONES.expired).not.toBe(PCC_COMPLIANCE_STATUS_TONES.near_expiry);
    expect(PCC_COMPLIANCE_STATUS_TONES.expired).not.toBe(PCC_COMPLIANCE_STATUS_TONES.current);
    expect(PCC_COMPLIANCE_STATUS_KEYS.expired).not.toBe(PCC_COMPLIANCE_STATUS_KEYS.near_expiry);
  });
});
