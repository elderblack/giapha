import { getSupabase } from '../../lib/supabase'
import { guessFeedMediaKind } from './guessFeedMedia'

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (!m) return 'bin'
  if (m.includes('webp')) return 'webp'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  if (m.includes('jpeg') || m.endsWith('/jpg')) return 'jpg'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'mp4'
  return 'bin'
}

function extOnlyFromFilename(name: string): string | null {
  const m = name.trim().match(/\.([a-zA-Z0-9]{2,14})$/i)
  const ext = (m?.[1] ?? '').toLowerCase()
  if (!ext) return null
  if (ext === 'jpeg') return 'jpg'
  return ext
}

function pickExt(file: File, isVid: boolean): string {
  const fromMime = extFromMime(file.type || '')
  if (fromMime !== 'bin') return fromMime === 'jpeg' ? 'jpg' : fromMime
  const fromName = extOnlyFromFilename(file.name)
  if (!fromName) return isVid ? 'mp4' : 'jpg'
  return fromName
}

function guessContentTypeForUpload(file: File, ext: string, isVid: boolean): string {
  const t = file.type.trim()
  if (t) return t
  if (isVid) {
    if (ext === 'webm') return 'video/webm'
    if (ext === 'mov') return 'video/quicktime'
    return 'video/mp4'
  }
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return 'image/jpeg'
}

export type PublishFeedPostResult = { ok: true } | { ok: false; error: string }

/**
 * Upload chỉ diễn ra khi gọi API này (sau người dùng bấm đăng bài).
 */
export async function publishFamilyFeedPost(params: {
  treeId: string
  authorId: string
  bodyDraft: string
  files: File[]
}): Promise<PublishFeedPostResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'offline' }

  const text = params.bodyDraft.trim()
  const hasParts = Boolean(text.length) || params.files.length > 0
  if (!hasParts) return { ok: false, error: 'empty' }

  const { data: ins, error: ie } = await sb
    .from('family_feed_posts')
    .insert({
      family_tree_id: params.treeId,
      author_id: params.authorId,
      body: text.length ? text : null,
    })
    .select('id')
    .single()

  if (ie || !ins?.id) {
    return { ok: false, error: ie?.message ?? 'insert' }
  }

  const postId = ins.id as string
  const { treeId, authorId, files } = params
  let order = 0

  for (const file of files) {
    const kind = guessFeedMediaKind(file)
    if (!kind) continue
    const isVid = kind === 'video'
    const ext = pickExt(file, isVid)
    const ct = guessContentTypeForUpload(file, ext, isVid)

    const storagePath = `${treeId}/${authorId}/${crypto.randomUUID()}.${ext}`
    const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, file, {
      upsert: true,
      contentType: ct,
    })
    if (ue) continue

    await sb.from('family_feed_post_media').insert({
      post_id: postId,
      storage_path: storagePath,
      media_kind: isVid ? 'video' : 'image',
      sort_order: order++,
    })
  }

  return { ok: true }
}
