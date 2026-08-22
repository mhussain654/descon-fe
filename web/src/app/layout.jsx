import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageProvider } from '../contexts/LanguageContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => {
        const apiError = error;
        if (apiError?.code === 'NETWORK_ERROR' || apiError?.code === 'TIMEOUT') {
          return failureCount < 2;
        }
        if (typeof apiError?.status === 'number' && apiError.status >= 500) {
          return failureCount < 1;
        }
        return false;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout({children}) {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </LanguageProvider>
  );
}