import { createImageVariants } from '../../lib/media/createImageVariants'
import { assertFeedImageSize } from '../../lib/media/mediaLimits'
import { logMediaUploadMetric } from '../../lib/media/telemetry'
import { getSupabase } from '../../lib/supabase'

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function sanitizeExt(file: File): string {
  const fromName = file.name.trim().match(/\.([a-zA-Z0-9]{2,8})$/)?.[1]?.toLowerCase()
  if (fromName && ALLOWED_EXT.includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName
  const fromMime = file.type.toLowerCase()
  if (fromMime.includes('png')) return 'png'
  if (fromMime.includes('webp')) return 'webp'
  if (fromMime.includes('gif')) return 'gif'
  return 'jpg'
}

function guessContentType(ext: string): string {
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

export async function uploadChatImage(params: {
  conversationId: string
  userId: string
  file: File
}): Promise<{ ok: true; path: string; thumbPath: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'offline' }

  const cap = assertFeedImageSize(params.file)
  if (cap) return { ok: false, error: cap }

  if (!params.file.type.startsWith('image/')) {
    return { ok: false, error: 'Chỉ chấp nhận file ảnh.' }
  }

  const id = crypto.randomUUID()
  const base = `${params.conversationId}/${params.userId}/${id}`

  try {
    const variants = await createImageVariants(params.file)
    if (variants.kind === 'passthrough') {
      const ext = variants.ext || sanitizeExt(params.file)
      const path = `${base}.${ext}`
      const ct = variants.mime || guessContentType(ext)
      logMediaUploadMetric({ context: 'family-chat-media', variant: path, bytes: variants.blob.size, mime: ct })
      const { error } = await sb.storage.from('family-chat-media').upload(path, variants.blob, {
        contentType: ct,
        upsert: false,
        cacheControl: '31536000',
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true, path, thumbPath: path }
    }

    const ext = variants.ext
    const thumbPath = `${base}_t.${ext}`
    const mainPath = `${base}_m.${ext}`
    const mime = variants.mime

    logMediaUploadMetric({
      context: 'family-chat-media',
      variant: thumbPath,
      bytes: variants.thumb.size,
      mime,
    })
    logMediaUploadMetric({
      context: 'family-chat-media',
      variant: mainPath,
      bytes: variants.medium.size,
      mime,
    })

    const upThumb = await sb.storage.from('family-chat-media').upload(thumbPath, variants.thumb, {
      contentType: mime,
      upsert: false,
      cacheControl: '31536000',
    })
    if (upThumb.error) return { ok: false, error: upThumb.error.message }

    const upMain = await sb.storage.from('family-chat-media').upload(mainPath, variants.medium, {
      contentType: mime,
      upsert: false,
      cacheControl: '31536000',
    })
    if (upMain.error) return { ok: false, error: upMain.error.message }

    return { ok: true, path: mainPath, thumbPath }
  } catch {
    const ext = sanitizeExt(params.file)
    const path = `${base}.${ext}`
    const { error } = await sb.storage.from('family-chat-media').upload(path, params.file, {
      contentType: guessContentType(ext),
      upsert: false,
      cacheControl: '31536000',
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, path, thumbPath: path }
  }
}
