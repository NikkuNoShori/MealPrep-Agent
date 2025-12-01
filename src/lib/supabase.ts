import { createClient } from '@supabase/supabase-js'
import { Logger } from '../services/logger'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  Logger.warn('⚠️ Supabase not configured. Missing environment variables:', {
    missingUrl: !supabaseUrl,
    missingAnonKey: !supabaseAnonKey
  })
  if (!supabaseUrl) Logger.warn('  - VITE_SUPABASE_URL')
  if (!supabaseAnonKey) Logger.warn('  - VITE_SUPABASE_ANON_KEY')
}

// Create Supabase client
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
)

Logger.info('✅ Supabase client initialized', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
})

