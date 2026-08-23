// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { STAFF_ADMIN_ERROR_KEYS } from './errorMessages';
import { translations } from '../i18n/translations';

describe('staff admin error -> translation key mapping', () => {
  it('maps every staff-admin server error code to a real, translated key', () => {
    for (const key of Object.values(STAFF_ADMIN_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
