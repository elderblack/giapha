import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Supabase Edge Functions (verify_jwt) yêu cầu header là JWT (legacy anon).
 * Publishable key `sb_publishable_...` không phải JWT → invoke trả 401.
 * Ưu tiên anon JWT; publishable chỉ là fallback cho PostgREST khi chưa có JWT.
 */
const anon =
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let client: SupabaseClient | null = null

if (url && anon) {
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function getSupabase(): SupabaseClient | null {
  return client
}

export function isSupabaseConfigured(): boolean {
  return client !== null
}
