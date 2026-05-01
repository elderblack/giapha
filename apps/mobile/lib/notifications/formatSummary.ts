export function notificationSummary(kind: string): string {
  switch (kind) {
    case 'post_created':
      return 'Bài mới trong dòng họ của bạn.'
    case 'post_reacted':
      return 'Có người phản hồi bài viết của bạn.'
    case 'comment_on_post':
    case 'comment_on_post_reply':
      return 'Bình luận mới trên bài viết.'
    case 'reply_to_comment':
      return 'Có người trả lời bình luận của bạn.'
    case 'friend_request':
      return 'Lời mời kết bạn mới.'
    case 'friend_request_accepted':
      return 'Lời mời kết bạn đã được chấp nhận.'
    case 'chat_message':
      return 'Bạn có tin nhắn mới.'
    default:
      return 'Thông báo mới.'
  }
}

export function formatNotificationDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}
