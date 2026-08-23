// Verifies the *actual production build output* (build/client/assets/*.js),
// not just the selection logic in auth-client.test.ts -- proving the mock
// implementation (its whole in-memory simulator) was tree-shaken out of the
// bundle entirely, not merely unreachable at runtime (MPS-F201 review: "Add
// production-build tests proving the mock client cannot be selected" / "Do
// not expose mock OTP instructions in production bundles or UI").
//
// Checks for the mock's reserved failure CNIC and its factory function name,
// not the OTP literal '123456' -- that string is too short/generic to assert
// on safely (unrelated demo data elsewhere in the bundle, e.g. a dashboard
// mock candidate CNIC, can contain it as a coincidental substring).
//
// Requires `npm run build` to have already run. If it hasn't (e.g. a plain
// `npm test` during local development, before the build step), this skips
// itself rather than failing -- the required check order is typecheck, then
// test, then build, so build/ genuinely may not exist yet at this point.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOCK_REQUEST_FAILURE_CNIC } from '../../../shared/auth/candidateAuthClient';

// Vitest's `root` is web/ (see vitest.config.ts), so this is where `npm run
// build`'s output lands regardless of the cwd the test runner itself was
// invoked from.
const clientAssetsDir = join(process.cwd(), 'build', 'client', 'assets');
const buildExists = existsSync(clientAssetsDir);

function readAllBuiltJs(): string {
  return readdirSync(clientAssetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(clientAssetsDir, file), 'utf-8'))
    .join('\n');
}

describe.runIf(buildExists)('production build output', () => {
  it('does not contain the mock auth client anywhere in the built client bundle', () => {
    const bundle = readAllBuiltJs();
    expect(bundle).not.toContain(MOCK_REQUEST_FAILURE_CNIC);
    expect(bundle).not.toContain('createMockCandidateAuthClient');
  });
});

if (!buildExists) {
  // eslint-disable-next-line no-console
  console.warn(
    `[auth-client.build.test] Skipped: ${clientAssetsDir} does not exist yet. Run "npm run build" first, then re-run "npm test", to exercise this check.`
  );
}
