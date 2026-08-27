// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { CANDIDATE_DOCUMENT_STATUS_KEYS, CANDIDATE_DOCUMENT_STATUS_TONES } from './statusLabels';
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
