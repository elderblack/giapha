import { getUserFamilyTreeId } from '../../lib/familyTreeMembership'
import { getSupabase } from '../../lib/supabase'
import { publishFamilyFeedPost } from '../feed/publishFeedPost'

export async function publishProfileMediaToFamilyFeed(opts: {
  userId: string
  bodyDraft: string
  file: File
}): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const treeId = await getUserFamilyTreeId(sb, opts.userId)
  if (!treeId) return
  const r = await publishFamilyFeedPost({
    treeId,
    authorId: opts.userId,
    bodyDraft: opts.bodyDraft,
    files: [opts.file],
  })
  if (!r.ok && import.meta.env.DEV) {
    console.warn('[publishProfileMediaToFamilyFeed]', r.error)
  }
}
