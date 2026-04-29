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
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'offline' }

  if (!params.file.type.startsWith('image/')) {
    return { ok: false, error: 'Chỉ chấp nhận file ảnh.' }
  }

  const ext = sanitizeExt(params.file)
  const path = `${params.conversationId}/${params.userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await sb.storage.from('family-chat-media').upload(path, params.file, {
    contentType: guessContentType(ext),
    upsert: false,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}
