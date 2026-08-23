// Verifies the *actual production build output* (build/client/assets/*.js),
// not just the selection logic in staff-auth-client.test.ts -- proving the
// mock staff-auth implementation was tree-shaken out of the bundle
// entirely, not merely unreachable at runtime. Same rationale/pattern as
// auth-client.build.test.ts (MPS-F201 review: "Add production-build tests
// proving the mock client cannot be selected").
//
// Requires `npm run build` to have already run. If it hasn't, this skips
// itself rather than failing -- the required check order is typecheck, then
// test, then build, so build/ genuinely may not exist yet at this point.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOCK_STAFF_PASSWORD } from '../../../shared/auth/staffAuthClient';

const clientAssetsDir = join(process.cwd(), 'build', 'client', 'assets');
const buildExists = existsSync(clientAssetsDir);

function readAllBuiltJs(): string {
  return readdirSync(clientAssetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(clientAssetsDir, file), 'utf-8'))
    .join('\n');
}

describe.runIf(buildExists)('production build output', () => {
  it('does not contain the mock staff-auth client anywhere in the built client bundle', () => {
    const bundle = readAllBuiltJs();
    expect(bundle).not.toContain(MOCK_STAFF_PASSWORD);
    expect(bundle).not.toContain('createMockStaffAuthClient');
    expect(bundle).not.toContain('createMockStaffDirectoryClient');
  });
});

if (!buildExists) {
  // eslint-disable-next-line no-console
  console.warn(
    `[staff-auth-client.build.test] Skipped: ${clientAssetsDir} does not exist yet. Run "npm run build" first, then re-run "npm test", to exercise this check.`
  );
}
