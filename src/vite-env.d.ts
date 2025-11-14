/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_API_URL?: string
  readonly MODE: string
  // Add other env vars as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

