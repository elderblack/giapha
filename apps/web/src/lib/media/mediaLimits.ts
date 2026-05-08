/** Giới hạn client trước khi upload (khớp bucket ~50MB video; ảnh an toàn hơn). */
export const MAX_FEED_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_FEED_VIDEO_BYTES = 200 * 1024 * 1024
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

export function assertFeedImageSize(file: File): string | null {
  if (file.size > MAX_FEED_IMAGE_BYTES) return 'Ảnh vượt quá 50MB.'
  return null
}

export function assertFeedVideoSize(file: File): string | null {
  if (file.size > MAX_FEED_VIDEO_BYTES) return 'Video vượt quá 200MB.'
  return null
}

export function assertProfileImageSize(file: File): string | null {
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return 'Ảnh vượt quá 5MB.'
  return null
}
