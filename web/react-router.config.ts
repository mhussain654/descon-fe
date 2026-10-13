import type { Config } from '@react-router/dev/config';

// The admin portal is a client-rendered single-page app: every screen loads
// its data in the browser from the Rails API (VITE_API_BASE_URL), and no route
// has a server loader or action. `ssr: false` makes `react-router build` emit
// static files (build/client) that Nginx serves directly -- no Node process in
// production. See docs/deployment/static-spa.md.
export default {
	appDirectory: './src/app',
	ssr: false,
} satisfies Config;
