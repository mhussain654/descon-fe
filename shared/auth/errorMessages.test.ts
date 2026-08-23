// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { AUTH_ERROR_KEYS, CNIC_FIELD_ERROR_KEYS } from './errorMessages';
import { translations } from '../i18n/translations';

describe('auth error -> translation key mapping', () => {
  it('maps every CNIC field error to a real, translated key', () => {
    for (const key of Object.values(CNIC_FIELD_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });

  it('maps every AuthErrorCode to a real, translated key', () => {
    for (const key of Object.values(AUTH_ERROR_KEYS)) {
      expect(translations.en).toHaveProperty(key);
      expect(translations.ur).toHaveProperty(key);
    }
  });
});
