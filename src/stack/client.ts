import { StackClientApp } from "@stackframe/js";
import { Logger } from '../services/logger';

const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID;
const publishableClientKey = (import.meta as any).env?.VITE_STACK_PUBLISHABLE_CLIENT_KEY;

Logger.info('🟢 StackClient: Initializing with config', {
  projectId: projectId ? 'configured' : 'missing',
  publishableClientKey: publishableClientKey ? 'configured' : 'missing',
  tokenStore: 'cookie'
});

// Only initialize Stack Auth if both required values are present
// This prevents the app from crashing during development
let stackClientApp: StackClientApp | null = null;

if (projectId && publishableClientKey) {
  try {
    stackClientApp = new StackClientApp({
      tokenStore: "cookie",
      projectId,
      publishableClientKey,
    });
    Logger.info('✅ Stack Auth initialized successfully');
  } catch (error: any) {
    Logger.error('❌ Stack Auth initialization failed', error);
  }
} else {
  Logger.warn('⚠️ Stack Auth not configured. Missing environment variables', {
    missingProjectId: !projectId,
    missingPublishableKey: !publishableClientKey
  });
  if (!projectId) Logger.warn('  - VITE_STACK_PROJECT_ID');
  if (!publishableClientKey) Logger.warn('  - VITE_STACK_PUBLISHABLE_CLIENT_KEY');
  Logger.warn('  See docs/core/STACK_AUTH_EXPLANATION.md for setup instructions');
}

// Export a non-null version that throws if not configured
export const getStackClientApp = (): StackClientApp => {
  if (!stackClientApp) {
    throw new Error(
      'Stack Auth is not configured. Please set VITE_STACK_PROJECT_ID and VITE_STACK_PUBLISHABLE_CLIENT_KEY in your .env file. ' +
      'See docs/Features/STACK_AUTH_EXPLANATION.md for setup instructions.'
    );
  }
  return stackClientApp;
};

// Export the nullable version for checking if auth is available
export { stackClientApp };
