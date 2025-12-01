/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // NOTE: VITE_OPENROUTER_API_KEY should NOT be used - API key must be stored as Supabase secret
  // Use Supabase Edge Functions for chat (which securely access OPENROUTER_API_KEY server-side)
  readonly VITE_FRONTEND_URL?: string
  readonly VITE_API_URL?: string
  readonly MODE: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
