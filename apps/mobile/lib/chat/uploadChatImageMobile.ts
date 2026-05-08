import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { Platform } from 'react-native'

import { readLocalUriIntoBlob } from '@/lib/feed/publishFamilyFeedPost'
import { getSupabase } from '@/lib/supabase'

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

async function uploadOneUri(params: {
  sb: NonNullable<ReturnType<typeof getSupabase>>
  localUri: string
  storagePath: string
  ct: string
  accessToken: string | null
  supabaseUrl: string
  anonKey: string
}): Promise<boolean> {
  const canNative = Boolean(
    params.accessToken && params.supabaseUrl && params.anonKey && /^file:\/\//i.test(params.localUri.trim()),
  )
  if (canNative) {
    const base = params.supabaseUrl.replace(/\/+$/, '')
    const url = `${base}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeSegments(params.storagePath)}`
    try {
      const res = await FileSystem.uploadAsync(url, params.localUri.trim(), {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          apikey: params.anonKey,
          'Content-Type': params.ct,
          'x-upsert': 'true',
          'cache-control': 'max-age=31536000',
        },
        ...(Platform.OS === 'ios'
          ? { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }
          : {}),
      })
      if (res.status >= 200 && res.status < 300) return true
    } catch {
      /* blob fallback */
    }
  }

  const blob = await readLocalUriIntoBlob(params.localUri.trim(), params.ct)
  if (!blob?.size) return false
  const { error } = await params.sb.storage.from(BUCKET).upload(params.storagePath, blob, {
    contentType: blob.type?.trim() || params.ct,
    upsert: false,
    cacheControl: '31536000',
  })
  return !error
}

export async function uploadChatImageMobile(params: {
  conversationId: string
  userId: string
  /** URI sau xử lý (file:// khuyến nghị) */
  fileUri: string
  mimeHint?: string | null
}): Promise<{ ok: true; storagePath: string; thumbPath: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Chưa kết nối máy chủ.' }

  const ext = extFromMimeOrUri(params.mimeHint, params.fileUri)
  const ct = contentTypeForExt(ext)
  const id = randomId()
  const storagePath = `${params.conversationId}/${params.userId}/${id}.${ext}`
  const thumbPath = `${params.conversationId}/${params.userId}/${id}_t.jpg`

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()
  const anonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim()
  const { data: sess } = await sb.auth.getSession()
  const accessToken = sess.session?.access_token ?? null

  const mainOk = await uploadOneUri({
    sb,
    localUri: params.fileUri,
    storagePath,
    ct,
    accessToken,
    supabaseUrl,
    anonKey,
  })
  if (!mainOk) return { ok: false, error: 'Không tải lên được ảnh.' }

  let thumbReady = false
  try {
    const thumbOut = await manipulateAsync(params.fileUri.trim(), [{ resize: { width: 320 } }], {
      compress: 0.88,
      format: SaveFormat.JPEG,
    })
    thumbReady = await uploadOneUri({
      sb,
      localUri: thumbOut.uri,
      storagePath: thumbPath,
      ct: 'image/jpeg',
      accessToken,
      supabaseUrl,
      anonKey,
    })
  } catch {
    thumbReady = false
  }

  return { ok: true, storagePath, thumbPath: thumbReady ? thumbPath : storagePath }
}
