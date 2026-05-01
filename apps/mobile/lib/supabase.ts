import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAuthStorage, useAuthKvStore } from '@/stores/authKvStore'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
/** Ưu tiên anon JWT giống web */
const anon =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''

let client: SupabaseClient | null = null

export function hasSupabaseCredentials(): boolean {
  return Boolean(url && anon)
}

/**
 * Hydrate Zustand từ SecureStore trước, rồi tạo client — để session không bị đọc rỗng.
 */
export async function bootstrapSupabase(): Promise<void> {
  if (client !== null || !hasSupabaseCredentials()) return
  await useAuthKvStore.persist.rehydrate()
  client = createClient(url, anon, {
    auth: {
      storage: getSupabaseAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export function getSupabase(): SupabaseClient | null {
  return client
}

/** Đã cấu hình env (không chờ bootstrap). */
export function isSupabaseConfigured(): boolean {
  return hasSupabaseCredentials()
}
