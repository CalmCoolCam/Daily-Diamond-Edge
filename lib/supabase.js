import { createClient } from '@supabase/supabase-js'

let _client = null

/**
 * Returns the Supabase client singleton.
 * Lazily created on first call so the module can be imported
 * without the env vars being defined (e.g. during static build).
 */
export function getSupabaseClient() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}
