import * as FileSystem from 'expo-file-system/legacy'
import { Platform } from 'react-native'

import { getSupabase } from '@/lib/supabase'
import { readLocalUriIntoBlob } from '@/lib/feed/publishFamilyFeedPost'

const BUCKET = 'family-chat-media'

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const

function encodeSegments(storagePath: string): string {
  return storagePath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

function randomId(): string {
  const g = globalThis.crypto as Crypto | undefined
  if (g?.randomUUID) return g.randomUUID()
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function extFromMimeOrUri(mime: string | null | undefined, uri: string): string {
  const m = (mime ?? '').toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('webp')) return 'webp'
  if (m.includes('gif')) return 'gif'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  const tail = uri.split(/[/\\]/).pop() ?? ''
  const dot = tail.lastIndexOf('.')
  const e = dot >= 0 ? tail.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  if (e === 'jpeg') return 'jpg'
  if (ALLOWED_EXT.includes(e as (typeof ALLOWED_EXT)[number])) return e
  return 'jpg'
}

function contentTypeForExt(ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

export async function uploadChatImageMobile(params: {
  conversationId: string
  userId: string
  /** URI sau xử lý (file:// khuyến nghị) */
  fileUri: string
  mimeHint?: string | null
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Chưa kết nối máy chủ.' }

  const ext = extFromMimeOrUri(params.mimeHint, params.fileUri)
  const ct = contentTypeForExt(ext)
  const storagePath = `${params.conversationId}/${params.userId}/${randomId()}.${ext}`

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()
  const anonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim()
  const { data: sess } = await sb.auth.getSession()
  const accessToken = sess.session?.access_token ?? null
  const local = params.fileUri.trim()
  const canNative = Boolean(accessToken && supabaseUrl && anonKey && /^file:\/\//i.test(local))

  if (canNative) {
    const base = supabaseUrl.replace(/\/+$/, '')
    const url = `${base}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeSegments(storagePath)}`
    try {
      const res = await FileSystem.uploadAsync(url, local, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
          'Content-Type': ct,
          'x-upsert': 'true',
        },
        ...(Platform.OS === 'ios'
          ? { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }
          : {}),
      })
      if (res.status >= 200 && res.status < 300) return { ok: true, storagePath }
    } catch {
      /* fallback */
    }
  }

  const blob = await readLocalUriIntoBlob(local, ct)
  if (!blob?.size)
    return { ok: false, error: 'Không đọc được ảnh.' }

  const { error } = await sb.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: ct,
    upsert: false,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, storagePath }
}
