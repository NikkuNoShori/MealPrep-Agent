import { StackClientApp } from "@stackframe/js";

const projectId = (import.meta as any).env?.VITE_STACK_PROJECT_ID || process.env.STACK_PROJECT_ID;
const publishableClientKey = (import.meta as any).env?.VITE_STACK_PUBLISHABLE_CLIENT_KEY || process.env.STACK_PUBLISHABLE_CLIENT_KEY;

console.log('🟢 StackClient: Initializing with config:', {
  projectId,
  publishableClientKey: publishableClientKey?.substring(0, 20) + '...',
  tokenStore: 'cookie'
});

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie",
  projectId,
  publishableClientKey,
});
