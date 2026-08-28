// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { APPLICATION_PROGRESS_ERROR_KEYS } from './errorMessages';
import { translations } from '../i18n/translations';

describe('application progress error -> translation key mapping', () => {
  it('maps every application-progress error code to a real, translated key', () => {
    for (const key of Object.values(APPLICATION_PROGRESS_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
