import { describe, expect, it } from 'vitest';
import { selectStaffDirectoryClient } from './staff-directory-client';

describe('selectStaffDirectoryClient', () => {
  it('selects the mock client in development, which returns seeded staff data', async () => {
    const client = selectStaffDirectoryClient(true);
    const staff = await client.listStaff();
    expect(staff.length).toBeGreaterThan(0);
  });

  it('never selects the mock client outside development -- every call fails safely instead', async () => {
    const client = selectStaffDirectoryClient(false);
    await expect(client.listStaff()).rejects.toMatchObject({ status: 503 });
    await expect(client.inviteStaff({ name: 'X', email: 'x@descon.com', role: 'viewer' })).rejects.toMatchObject({
      status: 503,
    });
  });
});
