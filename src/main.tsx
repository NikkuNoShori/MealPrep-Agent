import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'

import App from './App.tsx'
import './index.css'
import { QUERY_STALE_TIME } from './config/queryCache'

// ── Sentry error monitoring ───────────────────────────────────────────────────
// Initialise before React mounts so all errors are captured from the first render.
// DSN is intentionally public — Sentry rate-limits abuse by allowed domain.
Sentry.init({
  dsn: 'https://fcb06f3af3c549b9a506a1cd70768332@o4512041892511744.ingest.us.sentry.io/4512041961848832',
  environment: import.meta.env.MODE, // 'development' | 'production'
  enabled: import.meta.env.PROD,     // only send events in production builds

  // Capture 100% of errors; for performance tracing start low and tune later
  tracesSampleRate: 0.1,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Session Replay: record 10% of sessions, 100% on error
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// ── React Query ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: QUERY_STALE_TIME.domain,
    },
  },
})

// ── App mount ─────────────────────────────────────────────────────────────────
// Sentry.ErrorBoundary catches React render errors and reports them with
// the full component tree context. Falls back to a minimal error screen.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-[#0e0f13] p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-stone-800 dark:text-stone-200">
              Something went wrong
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {(error as Error)?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
