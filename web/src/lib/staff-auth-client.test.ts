import { describe, expect, it } from 'vitest';
import { MOCK_STAFF_ACCOUNTS, MOCK_STAFF_PASSWORD } from '../../../shared/auth/staffAuthClient';
import { selectStaffAuthClient } from './staff-auth-client';

const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'admin')!;

describe('selectStaffAuthClient', () => {
  it('selects the mock client in development, which accepts the documented mock credentials', async () => {
    const client = selectStaffAuthClient(true);
    await expect(client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD })).resolves.toMatchObject({
      staffId: ADMIN.staffId,
    });
  });

  it('never selects the mock client outside development -- every call fails safely instead', async () => {
    const client = selectStaffAuthClient(false);
    await expect(client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD })).rejects.toEqual({
      code: 'SERVICE_UNAVAILABLE',
    });
    await expect(client.restoreSession()).resolves.toBeNull();
    await expect(client.signOut()).resolves.toBeUndefined();
  });

  it('rejects the production client even with the documented mock credentials', async () => {
    const client = selectStaffAuthClient(false);
    await expect(client.signIn({ email: ADMIN.email, password: MOCK_STAFF_PASSWORD })).rejects.toEqual({
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
