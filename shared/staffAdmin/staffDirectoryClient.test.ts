// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createMockStaffDirectoryClient, createUnavailableStaffDirectoryClient } from './staffDirectoryClient';

describe('createMockStaffDirectoryClient', () => {
  it('lists the seeded staff members', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const staff = await client.listStaff();
    expect(staff.length).toBeGreaterThan(0);
    expect(staff.some((member) => member.role === 'admin')).toBe(true);
  });

  it('filters by query, role and status', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });

    const byQuery = await client.listStaff({ query: 'ayesha' });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].name).toBe('Ayesha Admin');

    const byRole = await client.listStaff({ role: 'manager' });
    expect(byRole.every((member) => member.role === 'manager')).toBe(true);

    const byStatus = await client.listStaff({ status: 'invited' });
    expect(byStatus.every((member) => member.status === 'invited')).toBe(true);
  });

  it('invites a new staff member with status "invited"', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const invited = await client.inviteStaff({ name: 'New Person', email: 'new.person@descon.com', role: 'viewer' });

    expect(invited.status).toBe('invited');
    expect(invited.invitedAt).toEqual(expect.any(String));

    const staff = await client.listStaff();
    expect(staff.some((member) => member.email === 'new.person@descon.com')).toBe(true);
  });

  it('rejects inviting a duplicate email with a field-addressable validation error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const error = await client
      .inviteStaff({ name: 'Duplicate', email: 'admin@descon.com', role: 'viewer' })
      .catch((e) => e);

    expect(error.status).toBe(422);
    expect(error.errors[0]).toMatchObject({ code: 'duplicate_email', field: 'email' });
  });

  it('updates a staff member role', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [manager] = await client.listStaff({ role: 'manager', status: 'active' });
    const updated = await client.updateStaffRole(manager.id, 'admin');
    expect(updated.role).toBe('admin');
  });

  it('rejects demoting the last remaining admin, with a conflict error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [admin] = await client.listStaff({ role: 'admin' });

    const error = await client.updateStaffRole(admin.id, 'manager').catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.errors[0].code).toBe('last_admin');

    // The role must be unchanged after the rejected update.
    const [stillAdmin] = await client.listStaff({ role: 'admin' });
    expect(stillAdmin.id).toBe(admin.id);
  });

  it('allows demoting an admin once a second admin exists', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [originalAdmin] = await client.listStaff({ role: 'admin' });
    const [manager] = await client.listStaff({ role: 'manager', status: 'active' });

    await client.updateStaffRole(manager.id, 'admin');
    const demoted = await client.updateStaffRole(originalAdmin.id, 'manager');
    expect(demoted.role).toBe('manager');
  });

  it('updates a staff member status (activate/suspend)', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [viewer] = await client.listStaff({ role: 'viewer', status: 'active' });
    const suspended = await client.updateStaffStatus(viewer.id, 'suspended');
    expect(suspended.status).toBe('suspended');

    const reactivated = await client.updateStaffStatus(viewer.id, 'active');
    expect(reactivated.status).toBe('active');
  });

  it('rejects suspending the last remaining active admin, with a conflict error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [admin] = await client.listStaff({ role: 'admin' });

    const error = await client.updateStaffStatus(admin.id, 'suspended').catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.errors[0].code).toBe('last_admin');
  });

  it('rejects updating an unknown staff id with a not-found error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const error = await client.updateStaffStatus('does-not-exist', 'suspended').catch((e) => e);
    expect(error.status).toBe(404);
  });

  it('each client instance starts from an independent seed (no cross-test leakage)', async () => {
    const clientA = createMockStaffDirectoryClient({ delayMs: 0 });
    const clientB = createMockStaffDirectoryClient({ delayMs: 0 });

    await clientA.inviteStaff({ name: 'Only In A', email: 'only-in-a@descon.com', role: 'viewer' });

    const staffB = await clientB.listStaff();
    expect(staffB.some((member) => member.email === 'only-in-a@descon.com')).toBe(false);
  });
});

describe('createUnavailableStaffDirectoryClient', () => {
  it('every method fails safely instead of returning or accepting mock data', async () => {
    const client = createUnavailableStaffDirectoryClient();
    await expect(client.listStaff()).rejects.toMatchObject({ status: 503 });
    await expect(client.inviteStaff({ name: 'X', email: 'x@descon.com', role: 'viewer' })).rejects.toMatchObject({
      status: 503,
    });
    await expect(client.updateStaffRole('any', 'admin')).rejects.toMatchObject({ status: 503 });
    await expect(client.updateStaffStatus('any', 'suspended')).rejects.toMatchObject({ status: 503 });
  });
});
