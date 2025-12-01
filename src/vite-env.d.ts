/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_OPENROUTER_API_KEY?: string
  readonly VITE_FRONTEND_URL?: string
  readonly VITE_API_URL?: string
  readonly MODE: string
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
