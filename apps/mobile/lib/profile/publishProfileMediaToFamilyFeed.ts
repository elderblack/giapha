import type { SupabaseClient } from '@supabase/supabase-js'

import { getUserFamilyTreeId } from '@/lib/familyTreeMembership'

export async function publishProfilePickerAssetToFamilyFeed(
  sb: SupabaseClient,
  opts: {
    userId: string
    bodyDraft: string
    storageBucket: string
    storagePath: string
    thumbPath: string
    mediumPath: string
  },
): Promise<void> {
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
    if (__DEV__) console.warn('[publishProfilePickerAssetToFamilyFeed]', ie?.message)
    return
  }

  const { error: me } = await sb.from('family_feed_post_media').insert({
    post_id: ins.id as string,
    storage_path: opts.storagePath,
    storage_bucket: opts.storageBucket,
    thumb_path: opts.thumbPath,
    medium_path: opts.mediumPath,
    media_kind: 'image',
    sort_order: 0,
  })

  if (me && __DEV__) {
    console.warn('[publishProfilePickerAssetToFamilyFeed]', me.message)
  }
}
