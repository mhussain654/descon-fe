// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { STAFF_AUTH_ERROR_KEYS } from './staffErrorMessages';
import { translations } from '../i18n/translations';

describe('staff auth error -> translation key mapping', () => {
  it('maps every StaffAuthErrorCode to a real, translated key', () => {
    for (const key of Object.values(STAFF_AUTH_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
