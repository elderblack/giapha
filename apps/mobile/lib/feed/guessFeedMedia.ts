export function guessMediaKindFromMimeAndUri(mimeHint: string | undefined, uriOrName: string): 'image' | 'video' | null {
  const raw = (mimeHint ?? '').trim().toLowerCase()
  if (raw.startsWith('video/')) return 'video'
  if (raw.startsWith('image/')) return 'image'
  const u = uriOrName.replace(/^.*[/\\]/, '').toLowerCase()
  if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(u)) return 'video'
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(u)) return 'image'
  return null
}
