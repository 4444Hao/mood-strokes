import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let cachedClient: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null
  }
  if (cachedClient) {
    return cachedClient
  }
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return cachedClient
}

export const MOOD_ENTRIES_TABLE = 'mood_entries'
export const PROFILES_TABLE = 'profiles'
export const MOOD_SUBMISSIONS_TABLE = 'mood_submissions'
export const FEATURED_TEMPLATES_TABLE = 'featured_templates'
