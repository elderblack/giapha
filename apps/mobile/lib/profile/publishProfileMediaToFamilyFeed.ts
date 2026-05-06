import type { SupabaseClient } from '@supabase/supabase-js'

import { publishFamilyFeedPostMobile, type PublishFeedAsset } from '@/lib/feed/publishFamilyFeedPost'
import { getUserFamilyTreeId } from '@/lib/familyTreeMembership'

export async function publishProfilePickerAssetToFamilyFeed(
  sb: SupabaseClient,
  opts: {
    userId: string
    bodyDraft: string
    asset: PublishFeedAsset
  },
): Promise<void> {
  const treeId = await getUserFamilyTreeId(sb, opts.userId)
  if (!treeId) return
  const r = await publishFamilyFeedPostMobile({
    treeId,
    authorId: opts.userId,
    bodyDraft: opts.bodyDraft,
    assets: [opts.asset],
  })
  if (!r.ok && __DEV__) {
    console.warn('[publishProfilePickerAssetToFamilyFeed]', r.error)
  }
}
