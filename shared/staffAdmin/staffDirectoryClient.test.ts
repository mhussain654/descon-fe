// Framework-agnostic: runs under both web's Vitest and mobile's Jest.
import { createMockStaffDirectoryClient } from './staffDirectoryClient';

describe('createMockStaffDirectoryClient', () => {
  it('lists the seeded staff members', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const staff = await client.listStaff();
    expect(staff.length).toBeGreaterThan(0);
    expect(staff.some((member) => member.role === 'admin')).toBe(true);
  });

  it('filters by query, role and status', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });

    const byQuery = await client.listStaff({ query: 'admin@descon' });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].email).toBe('admin@descon.com');

    const byRole = await client.listStaff({ role: 'hr' });
    expect(byRole.every((member) => member.role === 'hr')).toBe(true);

    const byStatus = await client.listStaff({ status: 'invited' });
    expect(byStatus.every((member) => member.status === 'invited')).toBe(true);
  });

  it('invites a new staff member with status "invited"', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const invited = await client.inviteStaff({ email: 'new.person@descon.com', role: 'finance' });

    expect(invited.status).toBe('invited');
    expect(invited.createdAt).toEqual(expect.any(String));

    const staff = await client.listStaff();
    expect(staff.some((member) => member.email === 'new.person@descon.com')).toBe(true);
  });

  it('rejects inviting a duplicate email with a field-addressable validation error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const error = await client.inviteStaff({ email: 'admin@descon.com', role: 'finance' }).catch((e) => e);

    expect(error.status).toBe(422);
    expect(error.errors[0]).toMatchObject({ code: 'validation_failed', field: 'email' });
  });

  it('updates a staff member role', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [hr] = await client.listStaff({ role: 'hr', status: 'active' });
    const updated = await client.updateStaffRole(hr.id, 'admin');
    expect(updated.role).toBe('admin');
  });

  it('rejects demoting the last remaining admin, with a field-addressable validation error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [admin] = await client.listStaff({ role: 'admin' });

    const error = await client.updateStaffRole(admin.id, 'hr').catch((e) => e);
    expect(error.status).toBe(422);
    expect(error.errors[0]).toMatchObject({ code: 'validation_failed', field: 'user.role' });

    // The role must be unchanged after the rejected update.
    const [stillAdmin] = await client.listStaff({ role: 'admin' });
    expect(stillAdmin.id).toBe(admin.id);
  });

  it('allows demoting an admin once a second admin exists', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [originalAdmin] = await client.listStaff({ role: 'admin' });
    const [hr] = await client.listStaff({ role: 'hr', status: 'active' });

    await client.updateStaffRole(hr.id, 'admin');
    const demoted = await client.updateStaffRole(originalAdmin.id, 'hr');
    expect(demoted.role).toBe('hr');
  });

  it('updates a staff member status (activate/suspend)', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [finance] = await client.listStaff({ role: 'finance', status: 'active' });
    const suspended = await client.updateStaffStatus(finance.id, 'suspended');
    expect(suspended.status).toBe('suspended');

    const reactivated = await client.updateStaffStatus(finance.id, 'active');
    expect(reactivated.status).toBe('active');
  });

  it('rejects suspending the last remaining active admin, with a field-addressable validation error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const [admin] = await client.listStaff({ role: 'admin' });

    const error = await client.updateStaffStatus(admin.id, 'suspended').catch((e) => e);
    expect(error.status).toBe(422);
    expect(error.errors[0]).toMatchObject({ code: 'validation_failed', field: 'user.staff_state' });
  });

  it('rejects updating an unknown staff id with a not-found error', async () => {
    const client = createMockStaffDirectoryClient({ delayMs: 0 });
    const error = await client.updateStaffStatus('does-not-exist', 'suspended').catch((e) => e);
    expect(error.status).toBe(404);
  });

  it('each client instance starts from an independent seed (no cross-test leakage)', async () => {
    const clientA = createMockStaffDirectoryClient({ delayMs: 0 });
    const clientB = createMockStaffDirectoryClient({ delayMs: 0 });

    await clientA.inviteStaff({ email: 'only-in-a@descon.com', role: 'finance' });

    const staffB = await clientB.listStaff();
    expect(staffB.some((member) => member.email === 'only-in-a@descon.com')).toBe(false);
  });
});
