import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

type ApiHandler = (
  request: Request,
  context: { params: Record<string, string> },
) => Response | Promise<Response>;

type RouteModule = Partial<
  Record<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH', ApiHandler>
>;

const routeModules = import.meta.glob<RouteModule>(
  '../src/app/api/**/route.js',
  { eager: true },
);

function routePath(routeFile: string): string {
  const relativePath = routeFile
    .replace('../src/app/api', '')
    .replace(/\/route\.js$/, '');

  if (!relativePath) return '/';

  return relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
      if (!match) return segment;

      const [, dots, parameter] = match;
      return dots === '...' ? `:${parameter}{.+}` : `:${parameter}`;
    })
    .join('/')
    .replace(/^/, '/');
}

function registerRoutes() {
  api.routes = [];

  const entries = Object.entries(routeModules).sort(
    ([left], [right]) => right.length - left.length,
  );

  for (const [routeFile, routeModule] of entries) {
    const path = routePath(routeFile);
    const handlerFor = (routeHandler: ApiHandler): Handler => async (context) =>
      routeHandler(context.req.raw, { params: context.req.param() });

    if (routeModule.GET) api.get(path, handlerFor(routeModule.GET));
    if (routeModule.POST) api.post(path, handlerFor(routeModule.POST));
    if (routeModule.PUT) api.put(path, handlerFor(routeModule.PUT));
    if (routeModule.DELETE) api.delete(path, handlerFor(routeModule.DELETE));
    if (routeModule.PATCH) api.patch(path, handlerFor(routeModule.PATCH));
  }
}

registerRoutes();

if (import.meta.hot) {
  import.meta.hot.accept(() => registerRoutes());
}

export { api, API_BASENAME };
