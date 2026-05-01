export function guessMediaKindFromMimeAndUri(mimeHint: string | undefined, uriOrName: string): 'image' | 'video' | null {
  const raw = (mimeHint ?? '').trim().toLowerCase()
  if (raw.startsWith('video/')) return 'video'
  if (raw.startsWith('image/')) return 'image'
  const u = uriOrName.replace(/^.*[/\\]/, '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(u)) return 'video'
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp|tif|tiff|avif|svg)$/i.test(u)) return 'image'
  return null
}

/** Expo ImagePicker: ưu tiên `type`, `duration`, MIME, đuôi URI; giống web — không xác định thì coi là ảnh (trừ duration>0). */
export function guessMediaKindFromPickerAsset(asset: {
  uri: string
  mimeType?: string | null
  type?: 'image' | 'video' | 'livePhoto' | 'pairedVideo' | null | unknown
  duration?: number | null
}): 'image' | 'video' | null {
  if (asset.type === 'video' || asset.type === 'pairedVideo') return 'video'
  if (asset.type === 'image' || asset.type === 'livePhoto') return 'image'
  if (typeof asset.duration === 'number' && asset.duration > 0 && !Number.isNaN(asset.duration)) {
    return 'video'
  }
  const fromMime = guessMediaKindFromMimeAndUri(asset.mimeType ?? undefined, asset.uri)
  if (fromMime) return fromMime
  /** Android ContentProvider đôi khi trả `type: null` và URI không có đuôi — vẫn cần đăng được như web (mặc định ảnh). */
  if (asset.type == null) return 'image'
  return null
}
