#!/usr/bin/env node
// Verifies a production build of the admin portal before it is packaged for
// deployment (deploy/bin/build-artifact runs it; CI runs it too). It guards
// the properties the static deployment depends on:
//
//   * the build is a static SPA: index.html exists and no Node server bundle
//     sits beside it;
//   * the API base URL baked in at build time is the intended public one, and
//     no development default (localhost/ngrok) leaked into the assets;
//   * nothing from the prototype mock API (src/app/api) was bundled.
//
// Usage: node scripts/verify-static-build.mjs --api-base https://host/api/v1 build/client

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_DEVELOPMENT_URLS = ['localhost:3000', '127.0.0.1:3000', 'ngrok'];
const FORBIDDEN_MOCK_MARKERS = ['mock-db', 'nextCandidateId'];

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

export function verifyStaticBuild({ clientDir, apiBase }) {
  const problems = [];
  const indexPath = path.join(clientDir, 'index.html');

  if (!existsSync(clientDir) || !statSync(clientDir).isDirectory()) {
    return [`build directory not found: ${clientDir}`];
  }
  if (!existsSync(indexPath)) {
    problems.push('index.html is missing: this is not an SPA build (is `ssr` still true?)');
  } else if (!readFileSync(indexPath, 'utf8').includes('__reactRouterContext')) {
    problems.push('index.html does not contain the React Router SPA shell');
  }

  if (existsSync(path.join(path.dirname(clientDir), 'server'))) {
    problems.push('a server bundle (build/server) exists beside the client build');
  }

  const scripts = listFiles(clientDir).filter((file) => file.endsWith('.js'));
  const contents = scripts.map((file) => readFileSync(file, 'utf8'));

  if (apiBase && !contents.some((text) => text.includes(apiBase))) {
    problems.push(`the API base URL ${apiBase} is not present in any JavaScript asset (VITE_API_BASE_URL not applied?)`);
  }
  for (const needle of FORBIDDEN_DEVELOPMENT_URLS) {
    if (contents.some((text) => text.includes(needle))) {
      problems.push(`a development address (${needle}) is baked into the build`);
    }
  }
  for (const marker of FORBIDDEN_MOCK_MARKERS) {
    if (contents.some((text) => text.includes(marker))) {
      problems.push(`prototype mock API code (${marker}) is bundled`);
    }
  }
  return problems;
}

function main(argv) {
  const apiFlag = argv.indexOf('--api-base');
  const apiBase = apiFlag === -1 ? undefined : argv[apiFlag + 1];
  const clientDir = argv.filter((value, index) => !value.startsWith('--') && index !== apiFlag + 1)[0];
  if (!clientDir) {
    console.error('usage: verify-static-build.mjs [--api-base <url>] <build/client directory>');
    return 2;
  }

  const problems = verifyStaticBuild({ clientDir: path.resolve(clientDir), apiBase });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL  ${problem}`);
    return 1;
  }
  console.log(`OK    static SPA build verified${apiBase ? ` (API base ${apiBase})` : ''}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
