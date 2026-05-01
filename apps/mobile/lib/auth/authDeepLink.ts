import type { SupabaseClient } from '@supabase/supabase-js'

/** Trích query/hash từ URL (scheme tùy chỉnh + fragment Supabase). */
function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  const addPart = (raw: string) => {
    for (const pair of raw.split('&')) {
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const k = decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' '))
      const v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '))
      if (k) out[k] = v
    }
  }
  const hashI = url.indexOf('#')
  if (hashI >= 0) addPart(url.slice(hashI + 1))
  const qI = url.indexOf('?')
  if (qI >= 0) {
    const end = hashI >= 0 ? hashI : url.length
    addPart(url.slice(qI + 1, end))
  }
  return out
}

/**
 * Áp JWT từ link email Supabase (recovery / magic link) vào client.
 * Cần thêm URL redirect trong Supabase Dashboard (Auth → URL) khớp `Linking.createURL('reset-password')`.
 */
export async function consumeSupabaseAuthUrl(
  sb: SupabaseClient,
  url: string,
): Promise<{ consumed: boolean; error?: string }> {
  const params = parseAuthParamsFromUrl(url)
  const code = params.code
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) return { consumed: false, error: error.message }
    return { consumed: true }
  }
  const access_token = params.access_token
  const refresh_token = params.refresh_token
  if (access_token && refresh_token) {
    const { error } = await sb.auth.setSession({ access_token, refresh_token })
    if (error) return { consumed: false, error: error.message }
    return { consumed: true }
  }
  return { consumed: false }
}
