import { LanguageProvider } from '../contexts/LanguageContext';

// QueryClientProvider now lives in root.tsx, above AuthProvider -- see the
// comment there. This per-page layout is remounted on every navigation
// (plugins/layouts.ts), which would otherwise also remount QueryClientProvider
// and detach AuthProvider's cached QueryClient reference.
export default function RootLayout({ children }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
