/**
 * MIME thường thiếu trên một số thiết bị (Safari/iOS HEIC…). Dùng tên file fallback.
 */
export function guessFeedMediaKind(file: File): 'image' | 'video' | null {
  const raw = file.type.trim().toLowerCase()
  if (raw.startsWith('video/')) return 'video'
  if (raw.startsWith('image/')) return 'image'
  const n = file.name.toLowerCase()
  const base = (n.includes('\\') ? n.split('\\').pop() : n.includes('/') ? n.split('/').pop() : n) ?? n
  if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(base ?? '')) return 'video'
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tif2|svg|avif)$/i.test(base ?? '')) return 'image'
  return null
}

/** Cho preview composer: không xác định thì hiển thị như ảnh. */
export function fileKindForPreview(file: File): 'image' | 'video' {
  const g = guessFeedMediaKind(file)
  if (g) return g
  return file.type.includes('video') ? 'video' : 'image'
}
