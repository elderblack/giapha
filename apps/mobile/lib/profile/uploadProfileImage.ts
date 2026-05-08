import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import type { SupabaseClient } from '@supabase/supabase-js'

import { assertProfileImageSizeBytes } from '@/lib/media/mediaLimits'

function randomId(): string {
  const g = globalThis.crypto as Crypto | undefined
  if (g?.randomUUID) return g.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function fetchUriByteLength(uri: string): Promise<number | null> {
  try {
    const res = await fetch(uri)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return buf.byteLength
  } catch {
    return null
  }
}

/**
 * Upload ảnh profile + biến thể thumb/medium (JPEG), trả path trong bucket profile-media.
 */
export async function uploadProfileImageFromPickerUri(
  sb: SupabaseClient,
  opts: {
    userId: string
    uri: string
    kind: 'avatar' | 'cover'
  },
): Promise<
  | {
      publicUrl: string
      thumbPath: string
      mediumPath: string
      mainStoragePath: string
    }
  | { error: string }
> {
  const { userId, uri, kind } = opts
  const id = randomId()
  const base = `${userId}/${kind}-${id}`

  const bytes = await fetchUriByteLength(uri)
  if (bytes != null) {
    const cap = assertProfileImageSizeBytes(bytes)
    if (cap) return { error: cap }
  }

  try {
    const thumbSize = kind === 'avatar' ? 256 : 720
    const mediumSize = kind === 'avatar' ? 512 : 1920

    const thumbOut = await manipulateAsync(uri, [{ resize: { width: thumbSize } }], {
      compress: 0.85,
      format: SaveFormat.JPEG,
    })
    const medOut = await manipulateAsync(uri, [{ resize: { width: mediumSize } }], {
      compress: 0.85,
      format: SaveFormat.JPEG,
    })

    const thumbPath = `${base}_t.jpg`
    const mediumPath = `${base}.jpg`

    async function uploadFileUri(localUri: string, path: string): Promise<boolean> {
      const res = await fetch(localUri)
      if (!res.ok) return false
      const buf = await res.arrayBuffer()
      const { error } = await sb.storage.from('profile-media').upload(path, buf, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      })
      return !error
    }

    const okT = await uploadFileUri(thumbOut.uri, thumbPath)
    const okM = await uploadFileUri(medOut.uri, mediumPath)
    if (!okT || !okM) return { error: 'Không tải lên được ảnh.' }

    const {
      data: { publicUrl },
    } = sb.storage.from('profile-media').getPublicUrl(mediumPath)

    return {
      publicUrl,
      thumbPath,
      mediumPath,
      mainStoragePath: mediumPath,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi tải ảnh lên.'
    return { error: msg }
  }
}
