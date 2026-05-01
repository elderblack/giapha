import { getSupabase } from '@/lib/supabase'

import { guessMediaKindFromMimeAndUri } from './guessFeedMedia'

export type PublishFeedPostResult = { ok: true } | { ok: false; error: string }

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (!m) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  if (m.includes('jpeg') || m.endsWith('/jpg')) return 'jpg'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'mp4'
  return 'jpg'
}

function randomUuid(): string {
  const g = globalThis.crypto as Crypto | undefined
  if (g?.randomUUID) return g.randomUUID()
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Ảnh / video cục bộ (Expo picker) đồng bộ luồng web: bucket `family-feed-media`. */
export async function publishFamilyFeedPostMobile(params: {
  treeId: string
  authorId: string
  bodyDraft: string
  assets: { uri: string; mimeType?: string | null }[]
}): Promise<PublishFeedPostResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'offline' }

  const text = params.bodyDraft.trim()
  const hasParts = Boolean(text.length) || params.assets.length > 0
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
  let order = 0

  for (const asset of params.assets) {
    const uri = asset.uri.trim()
    if (!uri.length) continue
    const kind = guessMediaKindFromMimeAndUri(asset.mimeType ?? undefined, uri)
    if (!kind) continue

    const isVid = kind === 'video'
    const extFromAsset = asset.mimeType ? extFromMime(asset.mimeType) : isVid ? 'mp4' : 'jpg'

    let blob: Blob
    try {
      const response = await fetch(uri)
      blob = await response.blob()
    } catch {
      continue
    }

    const ct =
      blob.type ||
      asset.mimeType ||
      (isVid ? (extFromAsset === 'webm' ? 'video/webm' : 'video/mp4') : `image/jpeg`)

    const storagePath = `${params.treeId}/${params.authorId}/${randomUuid()}.${extFromAsset}`

    const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, blob, {
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
