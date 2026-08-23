import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setupTests.ts',
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      '../shared/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Node's resolution algorithm walks up from the *importing* file, so a
      // bare `import ... from 'react'` inside ../shared (a sibling of this
      // package, not an ancestor) can't find web's node_modules/react on its
      // own. Only shared/auth/useCnicOtpFlow.ts needs this today.
      react: path.resolve(__dirname, 'node_modules/react'),
    },
  },
  server: {
    fs: {
      allow: ['.', '../shared'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  cacheDir: './.vitest',
});
