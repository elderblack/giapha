import { getSupabase } from '../../lib/supabase'
import type { FeedReactionKind } from './reactionKinds'
import { parseReactionKind } from './reactionKinds'

export type FeedProfileLite = {
  id: string
  full_name: string
  avatar_url: string | null
}

export type FeedMediaRow = {
  id: string
  post_id: string
  storage_path: string
  media_kind: 'image' | 'video'
  sort_order: number
}

export type FeedReactionRow = {
  post_id: string
  user_id: string
  kind: FeedReactionKind
}

export type FeedCommentReactionRow = {
  comment_id: string
  user_id: string
  kind: FeedReactionKind
}

export type FeedCommentRow = {
  id: string
  post_id: string
  author_id: string
  parent_comment_id: string | null
  body: string
  created_at: string
}

export type FeedPostState = {
  id: string
  family_tree_id: string
  author_id: string
  body: string | null
  created_at: string
  /** Khi có (vd. trang hồ sơ): hiển thị tên dòng họ của bài */
  tree_name?: string | null
  profiles?: FeedProfileLite
  media: FeedMediaRow[]
  reactions: FeedReactionRow[]
  comments: Array<
    FeedCommentRow & {
      profiles?: FeedProfileLite
      reactions: FeedCommentReactionRow[]
      replies: Array<
        FeedCommentRow & { profiles?: FeedProfileLite; reactions: FeedCommentReactionRow[] }
      >
    }
  >
}

function publicFeedMediaUrl(storagePath: string): string | null {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = sb.storage.from('family-feed-media').getPublicUrl(storagePath)
  return data.publicUrl ?? null
}

async function loadProfiles(ids: string[]): Promise<Map<string, FeedProfileLite>> {
  const m = new Map<string, FeedProfileLite>()
  const sb = getSupabase()
  if (!sb || ids.length === 0) return m
  const unique = [...new Set(ids)]
  const { data, error } = await sb.from('profiles').select('id, full_name, avatar_url').in('id', unique)
  if (error || !data) return m
  for (const row of data as FeedProfileLite[]) {
    m.set(row.id, row)
  }
  return m
}

type BasePostRow = Pick<FeedPostState, 'id' | 'family_tree_id' | 'author_id' | 'body' | 'created_at'>

async function hydrateFeedPosts(postRows: BasePostRow[]): Promise<FeedPostState[]> {
  const sb = getSupabase()
  if (!sb || postRows.length === 0) return []

  const postIds = postRows.map((p) => p.id)

  const { data: mediaData } = await sb.from('family_feed_post_media').select('*').in('post_id', postIds)
  const { data: reData } = await sb.from('family_feed_post_reactions').select('*').in('post_id', postIds)
  const { data: cData } = await sb.from('family_feed_comments').select('*').in('post_id', postIds).order('created_at')
  const flatForR = (cData ?? []) as FeedCommentRow[]
  const commentIds = flatForR.map((c) => c.id)
  const { data: crData } =
    commentIds.length > 0
      ? await sb.from('family_feed_comment_reactions').select('*').in('comment_id', commentIds)
      : { data: [] as FeedCommentReactionRow[] }

  const mediaByPost = new Map<string, FeedMediaRow[]>()
  for (const row of (mediaData ?? []) as FeedMediaRow[]) {
    const arr = mediaByPost.get(row.post_id) ?? []
    arr.push(row)
    mediaByPost.set(row.post_id, arr)
  }
  for (const [, arr] of mediaByPost) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  const reactByPost = new Map<string, FeedReactionRow[]>()
  for (const raw of reData ?? []) {
    const row = raw as { post_id: string; user_id: string; kind: string }
    const k = parseReactionKind(row.kind)
    if (!k) continue
    const fr: FeedReactionRow = { post_id: row.post_id, user_id: row.user_id, kind: k }
    const arr = reactByPost.get(row.post_id) ?? []
    arr.push(fr)
    reactByPost.set(row.post_id, arr)
  }

  const allAuthorIds = new Set<string>()
  for (const p of postRows) allAuthorIds.add(p.author_id)
  const flatComments = (cData ?? []) as FeedCommentRow[]
  for (const c of flatComments) allAuthorIds.add(c.author_id)

  const profiles = await loadProfiles([...allAuthorIds])

  const commentsByPost = new Map<string, FeedCommentRow[]>()
  for (const c of flatComments) {
    const arr = commentsByPost.get(c.post_id) ?? []
    arr.push(c)
    commentsByPost.set(c.post_id, arr)
  }

  const reactByComment = new Map<string, FeedCommentReactionRow[]>()
  for (const raw of crData ?? []) {
    const row = raw as { comment_id: string; user_id: string; kind: string }
    const k = parseReactionKind(row.kind)
    if (!k) continue
    const fr: FeedCommentReactionRow = { comment_id: row.comment_id, user_id: row.user_id, kind: k }
    const arr = reactByComment.get(row.comment_id) ?? []
    arr.push(fr)
    reactByComment.set(row.comment_id, arr)
  }

  function reactionsFor(commentId: string): FeedCommentReactionRow[] {
    return reactByComment.get(commentId) ?? []
  }

  function buildCommentsFor(postId: string) {
    const list = commentsByPost.get(postId) ?? []
    const top = list.filter((c) => c.parent_comment_id === null).sort(byCreated)
    return top.map((c) => {
      const replies = list
        .filter((x) => x.parent_comment_id === c.id)
        .sort(byCreated)
        .map((r) => ({
          ...r,
          profiles: profiles.get(r.author_id),
          reactions: reactionsFor(r.id),
        }))
      return {
        ...c,
        profiles: profiles.get(c.author_id),
        reactions: reactionsFor(c.id),
        replies,
      }
    })
  }

  function byCreated(a: { created_at: string }, b: { created_at: string }) {
    return a.created_at.localeCompare(b.created_at)
  }

  return postRows.map((p) => ({
    ...p,
    profiles: profiles.get(p.author_id),
    media: mediaByPost.get(p.id) ?? [],
    reactions: reactByPost.get(p.id) ?? [],
    comments: buildCommentsFor(p.id),
  }))
}

export async function loadFeedTree(treeId: string): Promise<FeedPostState[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data: posts, error: pe } = await sb
    .from('family_feed_posts')
    .select('id,family_tree_id,author_id,body,created_at')
    .eq('family_tree_id', treeId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (pe || !posts?.length) {
    return []
  }

  const postRows = posts as BasePostRow[]
  return hydrateFeedPosts(postRows)
}

/** Bài của tài khoản (chỉ bài trong dòng họ bạn vẫn có quyền xem theo RLS). Phân trang bằng offset. */
export async function loadMyPostsPage(
  authorId: string,
  offset: number,
  pageSize: number,
): Promise<FeedPostState[]> {
  const sb = getSupabase()
  if (!sb) return []

  const to = offset + Math.max(1, pageSize) - 1
  const { data: posts, error } = await sb
    .from('family_feed_posts')
    .select('id,family_tree_id,author_id,body,created_at')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, to)

  if (error || !posts?.length) {
    return []
  }

  const postRows = posts as BasePostRow[]
  const hydrated = await hydrateFeedPosts(postRows)

  const treeIds = [...new Set(hydrated.map((p) => p.family_tree_id))]
  if (treeIds.length === 0) return hydrated

  const { data: trees } = await sb.from('family_trees').select('id, name').in('id', treeIds)

  const nameById = new Map<string, string>()
  if (trees) {
    for (const t of trees as { id: string; name: string }[]) {
      nameById.set(t.id, t.name)
    }
  }

  return hydrated.map((p) => ({
    ...p,
    tree_name: nameById.get(p.family_tree_id) ?? null,
  }))
}

/** Tải lại các bài theo id (vd. sau reaction/bình luận trong danh sách hồ sơ). */
export async function reloadFeedPostsByIds(postIds: string[]): Promise<Map<string, FeedPostState>> {
  const sb = getSupabase()
  const map = new Map<string, FeedPostState>()
  if (!sb || postIds.length === 0) return map
  const unique = [...new Set(postIds)]
  const { data: posts, error } = await sb
    .from('family_feed_posts')
    .select('id,family_tree_id,author_id,body,created_at')
    .in('id', unique)
  if (error || !posts?.length) return map

  const postRows = posts as BasePostRow[]
  const hydrated = await hydrateFeedPosts(postRows)

  const treeIds = [...new Set(hydrated.map((p) => p.family_tree_id))]
  const nameById = new Map<string, string>()
  if (treeIds.length > 0) {
    const { data: trees } = await sb.from('family_trees').select('id, name').in('id', treeIds)
    if (trees) {
      for (const t of trees as { id: string; name: string }[]) {
        nameById.set(t.id, t.name)
      }
    }
  }

  const withTrees = hydrated.map((p) => ({
    ...p,
    tree_name: nameById.get(p.family_tree_id) ?? null,
  }))
  for (const p of withTrees) map.set(p.id, p)
  return map
}

/** Dòng họ user có vai trò → chọn trong ô đăng bài (= `family_tree_id` của bài). */
export async function loadUserTreesForComposer(userId: string): Promise<{ id: string; name: string }[]> {
  const sb = getSupabase()
  if (!sb) return []
  const { data, error } = await sb
    .from('family_tree_roles')
    .select('family_trees(id,name)')
    .eq('user_id', userId)
  if (error || !data?.length) return []
  const list: { id: string; name: string }[] = []
  for (const row of data as { family_trees: unknown }[]) {
    const ft = row.family_trees as
      | { id: string; name: string | null }
      | { id: string; name: string | null }[]
      | null
    const one = Array.isArray(ft) ? ft[0] : ft
    if (!one?.id) continue
    list.push({
      id: one.id,
      name: typeof one.name === 'string' && one.name.trim() ? one.name.trim() : 'Dòng họ',
    })
  }
  return list
}

/**
 * Chuỗi đại diện nội dung feed (đủ để phát hiện thay đổi bài, cảm xúc, bình luận).
 * Dùng để bỏ qua setState khi đã có dữ liệu giống hệt sau refresh.
 */
export function feedPostsFingerprint(posts: FeedPostState[]): string {
  return posts
    .map((p) => {
      const rx = [...p.reactions]
        .map((r) => `${r.user_id}:${r.kind}`)
        .sort()
        .join(',')
      const cx = p.comments
        .map((c) => {
          const rrx = [...(c.reactions ?? [])]
            .map((x) => `${x.user_id}:${x.kind}`)
            .sort()
            .join(',')
          const rids = c.replies
            .map((r) => {
              const srr = [...(r.reactions ?? [])]
                .map((x) => `${x.user_id}:${x.kind}`)
                .sort()
                .join(',')
              return `${r.id}:${r.body.length}:${srr}`
            })
            .sort()
            .join(',')
          return `${c.id}:${c.body.length}:${rrx}:${rids}`
        })
        .join(';')
      const mids = p.media
        .map((m) => m.id)
        .sort()
        .join(',')
      return `${p.id}\t${p.body ?? ''}\t${mids}\t${rx}\t${cx}`
    })
    .join('\n')
}

/** URL công khai cho file trong bucket tin dòng họ */
export function getFeedMediaPublicUrl(storagePath: string): string | null {
  return publicFeedMediaUrl(storagePath)
}
