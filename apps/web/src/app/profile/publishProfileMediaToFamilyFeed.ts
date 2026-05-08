import { getUserFamilyTreeId } from '../../lib/familyTreeMembership'
import { getSupabase } from '../../lib/supabase'

/**
 * Tạo bài tin trỏ tới file đã có trong Storage (không upload lại).
 */
export async function publishProfileMediaToFamilyFeed(opts: {
  userId: string
  bodyDraft: string
  storageBucket: string
  /** Path canonical (ảnh vừa — medium / ảnh gốc đã upload). */
  storagePath: string
  thumbPath: string
  mediumPath: string
  mediaKind: 'image'
}): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const treeId = await getUserFamilyTreeId(sb, opts.userId)
  if (!treeId) return

  const { data: ins, error: ie } = await sb
    .from('family_feed_posts')
    .insert({
      family_tree_id: treeId,
      author_id: opts.userId,
      body: opts.bodyDraft.trim() || null,
    })
    .select('id')
    .single()

  if (ie || !ins?.id) {
    if (import.meta.env.DEV) console.warn('[publishProfileMediaToFamilyFeed]', ie?.message)
    return
  }

  const { error: me } = await sb.from('family_feed_post_media').insert({
    post_id: ins.id as string,
    storage_path: opts.storagePath,
    storage_bucket: opts.storageBucket,
    thumb_path: opts.thumbPath,
    medium_path: opts.mediumPath,
    media_kind: opts.mediaKind,
    sort_order: 0,
  })

  if (me && import.meta.env.DEV) {
    console.warn('[publishProfileMediaToFamilyFeed]', me.message)
  }
}
