/** Logic thông báo dùng chung cho web và mobile (copy, gom id hồ sơ, deep link). */

export type NotificationPayload = Record<string, unknown>

export function notificationPayloadString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export function collectProfileIdsFromNotificationRows(
  rows: { kind: string; payload: NotificationPayload }[],
): string[] {
  const ids = new Set<string>()
  for (const r of rows) {
    const p = r.payload
    const fromP = notificationPayloadString(p.by_user_id)
    const author = notificationPayloadString(p.author_id)
    const fromId = notificationPayloadString(p.from_id)
    if (fromP) ids.add(fromP)
    if (author) ids.add(author)
    if (fromId) ids.add(fromId)
  }
  return [...ids]
}

const REACTION_LABEL_VI: Record<string, string> = {
  like: 'Thích',
  love: 'Yêu thích',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Buồn',
  angry: 'Phẫn nộ',
}

function personLabel(nameById: Record<string, string>, id: string | undefined): string {
  if (!id) return 'Ai đó'
  const n = nameById[id]?.trim()
  return n && n.length > 0 ? n : 'Thành viên'
}

/** Tiêu đề + dòng phụ (gợi ý hành động). */
export function notificationDisplay(
  kind: string,
  payload: NotificationPayload,
  nameById: Record<string, string>,
): { title: string; detail?: string } {
  const by = personLabel(nameById, notificationPayloadString(payload.by_user_id))
  const author = personLabel(nameById, notificationPayloadString(payload.author_id))
  const from = personLabel(nameById, notificationPayloadString(payload.from_id))
  const accepter = personLabel(nameById, notificationPayloadString(payload.by_user_id))

  switch (kind) {
    case 'post_created':
      return {
        title: `${author} đăng bài trong dòng họ`,
        detail: 'Xem bài viết',
      }
    case 'post_reacted': {
      const rk = notificationPayloadString(payload.kind)
      const rx = rk ? (REACTION_LABEL_VI[rk] ?? rk) : 'phản hồi'
      return {
        title: `${by} đã ${rx.toLowerCase()} bài của bạn`,
        detail: 'Xem bài viết',
      }
    }
    case 'comment_on_post':
      return {
        title: `${by} bình luận bài viết của bạn`,
        detail: 'Xem bình luận',
      }
    case 'comment_on_post_reply':
      return {
        title: `${by} trả lời trong chủ đề bài của bạn`,
        detail: 'Xem cuộc trò chuyện',
      }
    case 'reply_to_comment':
      return {
        title: `${by} trả lời bình luận của bạn`,
        detail: 'Xem bình luận',
      }
    case 'friend_request':
      return {
        title: `${from} gửi lời mời kết bạn`,
        detail: 'Mở trang Kết nối',
      }
    case 'friend_request_accepted':
      return {
        title: `${accepter} đã chấp nhận lời mời kết bạn`,
        detail: 'Mở trang Kết nối',
      }
    case 'chat_message':
      return {
        title: `${from} gửi tin nhắn mới`,
        detail: 'Mở chat',
      }
    default:
      return { title: 'Thông báo mới', detail: undefined }
  }
}

/** Đích điều hướng web (pathname đầy đủ kèm `/app`). */
export function webNotificationNavigateTo(row: {
  kind: string
  payload: NotificationPayload
  family_tree_id: string | null
}): string | null {
  const postId = notificationPayloadString(row.payload.post_id)
  const convId = notificationPayloadString(row.payload.conversation_id)

  switch (row.kind) {
    case 'post_created':
    case 'post_reacted':
    case 'comment_on_post':
    case 'comment_on_post_reply':
    case 'reply_to_comment':
      if (!postId || !row.family_tree_id) return null
      return `/app/home?tree=${encodeURIComponent(row.family_tree_id)}&post=${encodeURIComponent(postId)}`
    case 'friend_request':
    case 'friend_request_accepted':
      return '/app/connections'
    case 'chat_message':
      if (!convId) return null
      return `/app/chat/${encodeURIComponent(convId)}`
    default:
      return null
  }
}

/** Href Expo Router (mobile). */
export function mobileNotificationNavigateTo(row: {
  kind: string
  payload: NotificationPayload
  family_tree_id: string | null
}): string | null {
  const postId = notificationPayloadString(row.payload.post_id)
  const convId = notificationPayloadString(row.payload.conversation_id)

  switch (row.kind) {
    case 'post_created':
    case 'post_reacted':
    case 'comment_on_post':
    case 'comment_on_post_reply':
    case 'reply_to_comment':
      if (!postId) return null
      return `/feed/${postId}`
    case 'friend_request':
    case 'friend_request_accepted':
      return '/(tabs)/connections'
    case 'chat_message':
      if (!convId) return null
      return `/chat/${convId}`
    default:
      return null
  }
}
