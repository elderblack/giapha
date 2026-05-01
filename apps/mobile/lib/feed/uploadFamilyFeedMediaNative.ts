import * as FileSystem from 'expo-file-system/legacy'
import { Platform } from 'react-native'

const BUCKET = 'family-feed-media'

export function encodeStorageObjectPath(storagePath: string): string {
  return storagePath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/** Upload trực tiếp từ `file://` — không nhét base64 vào heap (ảnh/video lớn, Android). */
export async function uploadFamilyFeedMediaNative(params: {
  supabaseUrl: string
  anonKey: string
  accessToken: string
  storagePath: string
  fileUri: string
  contentType: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const base = params.supabaseUrl.replace(/\/+$/, '')
  const encPath = encodeStorageObjectPath(params.storagePath)
  const url = `${base}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encPath}`
  const uri = params.fileUri.trim()

  try {
    const res = await FileSystem.uploadAsync(url, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        apikey: params.anonKey,
        'Content-Type': params.contentType,
        'x-upsert': 'true',
      },
      ...(Platform.OS === 'ios'
        ? { sessionType: FileSystem.FileSystemSessionType.BACKGROUND }
        : {}),
    })

    if (res.status >= 200 && res.status < 300) return { ok: true }

    let msg = `HTTP ${res.status}`
    try {
      const j = JSON.parse(res.body) as { message?: string; error?: string }
      if (typeof j.message === 'string') msg = j.message
      else if (typeof j.error === 'string') msg = j.error
    } catch {
      /* ignore */
    }
    return { ok: false, message: msg }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
