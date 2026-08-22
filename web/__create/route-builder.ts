import { Hono } from 'hono';
import type { Handler } from 'hono/types';

const API_BASENAME = '/api';
const api = new Hono();

const ROUTE_PREFIX = '../src/app/api/';

// Statically discovered at build time so this works identically in dev and
// in a bundled production build — unlike a runtime `readdir`, which only
// finds files when the original source tree is present on disk (true in
// dev, not true once `react-router build` inlines everything into a few
// output files).
const routeModules = import.meta.glob<Record<string, Handler | undefined>>(
  '../src/app/api/**/route.js',
  { eager: true }
);

/** Helper function to transform a glob-relative route file path to a Hono route path */
function getHonoPath(routeFile: string): { name: string; pattern: string }[] {
  const relativePath = routeFile.startsWith(ROUTE_PREFIX)
    ? routeFile.slice(ROUTE_PREFIX.length)
    : routeFile;
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

/** Register all statically-discovered routes */
function registerRoutes() {
  api.routes = [];

  const routeFiles = Object.keys(routeModules)
    .slice()
    .sort((a, b) => b.length - a.length);

  for (const routeFile of routeFiles) {
    const route = routeModules[routeFile];
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
    for (const method of methods) {
      if (route[method]) {
        const parts = getHonoPath(routeFile);
        const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
        const handler: Handler = async (c) => {
          const params = c.req.param();
          return await route[method]!(c.req.raw, { params });
        };
        switch (method) {
          case 'GET':
            api.get(honoPath, handler);
            break;
          case 'POST':
            api.post(honoPath, handler);
            break;
          case 'PUT':
            api.put(honoPath, handler);
            break;
          case 'DELETE':
            api.delete(honoPath, handler);
            break;
          case 'PATCH':
            api.patch(honoPath, handler);
            break;
        }
      }
    }
  }
}

registerRoutes();

// Hot reload routes in development. `registerRoutes` reads from the eagerly
// globbed `routeModules`, and Vite's HMR re-executes this module (re-running
// the glob) whenever a matched route.js file changes, so self-accepting is
// enough to pick up edited handlers without a full server restart.
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    registerRoutes();
  });
}

export { api, API_BASENAME };
