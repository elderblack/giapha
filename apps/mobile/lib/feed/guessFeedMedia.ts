export function guessMediaKindFromMimeAndUri(mimeHint: string | undefined, uriOrName: string): 'image' | 'video' | null {
  const raw = (mimeHint ?? '').trim().toLowerCase()
  if (raw.startsWith('video/')) return 'video'
  if (raw.startsWith('image/')) return 'image'
  const u = uriOrName.replace(/^.*[/\\]/, '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(u)) return 'video'
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(u)) return 'image'
  return null
}

/** Expo ImagePicker: ưu tiên `type` từ asset, rồi MIME, rồi đuôi tệp. */
export function guessMediaKindFromPickerAsset(asset: {
  uri: string
  mimeType?: string | null
  type?: 'image' | 'video' | unknown
}): 'image' | 'video' | null {
  if (asset.type === 'video') return 'video'
  if (asset.type === 'image') return 'image'
  return guessMediaKindFromMimeAndUri(asset.mimeType ?? undefined, asset.uri)
}
