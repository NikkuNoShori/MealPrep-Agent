/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STACK_PROJECT_ID?: string
  readonly VITE_STACK_PUBLISHABLE_CLIENT_KEY?: string
  readonly VITE_API_URL?: string
  readonly MODE: string
  // Add other env vars as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

