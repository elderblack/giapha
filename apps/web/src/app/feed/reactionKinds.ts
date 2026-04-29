export const FEED_REACTION_KINDS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const
export type FeedReactionKind = (typeof FEED_REACTION_KINDS)[number]

export const FEED_REACTION_VI: Record<FeedReactionKind, string> = {
  like: 'Thích',
  love: 'Yêu thích',
  haha: 'Haha',
  wow: 'Ồ hay',
  sad: 'Buồn',
  angry: 'Giận dữ',
}

/** Emoji cố định cho picker / ô tóm tắt (giống Facebook). */
export const FEED_REACTION_EMOJI: Record<FeedReactionKind, string> = {
  like: '👍',
  love: '❤️',
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😠',
}

export function reactionEmoji(kind: FeedReactionKind): string {
  return FEED_REACTION_EMOJI[kind]
}

export function parseReactionKind(s: string): FeedReactionKind | null {
  return FEED_REACTION_KINDS.includes(s as FeedReactionKind) ? (s as FeedReactionKind) : null
}
