// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { CANDIDATE_IMPORT_ERROR_KEYS } from './errorMessages';
import { translations } from '../i18n/translations';

describe('candidate import error -> translation key mapping', () => {
  it('maps every candidate-import error code to a real, translated key', () => {
    for (const key of Object.values(CANDIDATE_IMPORT_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
