import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import config from '../react-router.config';
import { verifyStaticBuild } from './verify-static-build.mjs';

const API_BASE = 'https://52.221.51.231/api/v1';
const SHELL = '<!doctype html><script>window.__reactRouterContext = {}</script>';
const roots = [];

function build({ index = SHELL, assets = { 'app.js': `const base = "${API_BASE}";` }, withServer = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'spa-build-'));
  roots.push(root);
  const client = path.join(root, 'client');
  mkdirSync(path.join(client, 'assets'), { recursive: true });
  if (index !== null) writeFileSync(path.join(client, 'index.html'), index);
  for (const [name, text] of Object.entries(assets)) writeFileSync(path.join(client, 'assets', name), text);
  if (withServer) mkdirSync(path.join(root, 'server'));
  return client;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

describe('react-router.config', () => {
  it('keeps the admin portal a static single-page app (no server rendering)', () => {
    expect(config.ssr).toBe(false);
  });
});

describe('verifyStaticBuild', () => {
  it('accepts a static build that carries the intended API base URL', () => {
    expect(verifyStaticBuild({ clientDir: build(), apiBase: API_BASE })).toEqual([]);
  });

  it('reports a missing build directory', () => {
    const problems = verifyStaticBuild({ clientDir: path.join(tmpdir(), 'does-not-exist-spa'), apiBase: API_BASE });
    expect(problems[0]).toMatch(/build directory not found/);
  });

  it('rejects a build without index.html (server-rendered output)', () => {
    const problems = verifyStaticBuild({ clientDir: build({ index: null }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/index\.html is missing/);
  });

  it('rejects an index.html that is not the SPA shell', () => {
    const problems = verifyStaticBuild({ clientDir: build({ index: '<html></html>' }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/SPA shell/);
  });

  it('rejects a server bundle beside the client build', () => {
    const problems = verifyStaticBuild({ clientDir: build({ withServer: true }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/server bundle/);
  });

  it('rejects a build that does not carry the intended API base URL', () => {
    const problems = verifyStaticBuild({ clientDir: build({ assets: { 'app.js': 'x' } }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/not present in any JavaScript asset/);
  });

  it('rejects a development address that leaked into the bundle', () => {
    const assets = { 'app.js': `const a = "${API_BASE}"; const b = "http://localhost:3000/api/v1";` };
    const problems = verifyStaticBuild({ clientDir: build({ assets }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/development address \(localhost:3000\)/);
  });

  it('does not treat the bare word localhost in library code as a leak', () => {
    const assets = { 'app.js': `const a = "${API_BASE}"; let base = "http://localhost";` };
    expect(verifyStaticBuild({ clientDir: build({ assets }), apiBase: API_BASE })).toEqual([]);
  });

  it('rejects bundled prototype mock API code', () => {
    const assets = { 'app.js': `const a = "${API_BASE}"; // mock-db` };
    const problems = verifyStaticBuild({ clientDir: build({ assets }), apiBase: API_BASE });
    expect(problems.join('\n')).toMatch(/prototype mock API/);
  });

  it('skips the API base check when none is given', () => {
    const assets = { 'app.js': 'console.log(1)' };
    expect(verifyStaticBuild({ clientDir: build({ assets }) })).toEqual([]);
  });
});
