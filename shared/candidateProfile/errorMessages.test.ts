// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { CANDIDATE_PROFILE_ERROR_KEYS } from './errorMessages';
import { translations } from '../i18n/translations';

describe('candidate profile error -> translation key mapping', () => {
  it('maps every candidate-profile error code to a real, translated key', () => {
    for (const key of Object.values(CANDIDATE_PROFILE_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
