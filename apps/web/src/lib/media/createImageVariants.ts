const THUMB_MAX = 320
const MEDIUM_MAX = 1080
const ORIGINAL_MAX_EDGE = 1920
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.82

export type ImageVariantsOk = {
  kind: 'variants'
  thumb: Blob
  medium: Blob
  original: Blob
  width: number
  height: number
  /** MIME của blob đã encode (webp hoặc jpeg) */
  mime: string
  /** Đuôi file đề xuất không gồm dấu chấm */
  ext: string
}

export type ImageVariantsPassthrough = {
  kind: 'passthrough'
  /** GIF/SVG/… — chỉ một blob, dùng cho cả ba path */
  blob: Blob
  width: number
  height: number
  mime: string
  ext: string
}

export type ImageVariantsResult = ImageVariantsOk | ImageVariantsPassthrough

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('webp')) return 'webp'
  if (m.includes('jpeg') || m.endsWith('/jpg')) return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  return 'jpg'
}

function fitInside(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const scale = Math.min(maxEdge / w, maxEdge / h, 1)
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

async function drawToBlob(
  bitmap: ImageBitmap,
  targetW: number,
  targetH: number,
  preferWebp: boolean,
): Promise<{ blob: Blob; mime: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)

  if (preferWebp) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY),
    )
    if (blob && blob.size > 0) return { blob, mime: 'image/webp' }
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob || blob.size === 0) throw new Error('encode')
  return { blob, mime: 'image/jpeg' }
}

export function isPassthroughImageFile(file: File): boolean {
  const n = file.name.toLowerCase()
  const t = file.type.toLowerCase()
  if (t === 'image/gif' || n.endsWith('.gif')) return true
  if (t === 'image/svg+xml' || n.endsWith('.svg')) return true
  return false
}

/**
 * Tạo thumb (320), medium (1080), original (tối đa cạnh 1920). GIF/SVG: không xử lý, trả passthrough.
 */
export async function createImageVariants(file: File): Promise<ImageVariantsResult> {
  if (isPassthroughImageFile(file)) {
    let w = 0
    let h = 0
    try {
      const bitmap = await createImageBitmap(file)
      w = bitmap.width
      h = bitmap.height
      bitmap.close()
    } catch {
      /* SVG / một số định dạng không decode được */
    }
    const mime = file.type.trim() || 'application/octet-stream'
    const nl = file.name.toLowerCase()
    const extFinal = nl.endsWith('.gif') ? 'gif' : nl.endsWith('.svg') ? 'svg' : extFromMime(mime)
    return {
      kind: 'passthrough',
      blob: file,
      width: w,
      height: h,
      mime,
      ext: extFinal,
    }
  }

  const bitmap = await createImageBitmap(file)
  try {
    const iw = bitmap.width
    const ih = bitmap.height
    const o = fitInside(iw, ih, ORIGINAL_MAX_EDGE)
    const t = fitInside(iw, ih, THUMB_MAX)
    const m = fitInside(iw, ih, MEDIUM_MAX)

    const preferWebp = typeof HTMLCanvasElement.prototype.toBlob === 'function'
    const thumb = await drawToBlob(bitmap, t.w, t.h, preferWebp)
    const medium = await drawToBlob(bitmap, m.w, m.h, preferWebp)
    const original = await drawToBlob(bitmap, o.w, o.h, preferWebp)

    const mime = thumb.mime
    const ext = mime.includes('webp') ? 'webp' : 'jpg'

    return {
      kind: 'variants',
      thumb: thumb.blob,
      medium: medium.blob,
      original: original.blob,
      width: o.w,
      height: o.h,
      mime,
      ext,
    }
  } finally {
    bitmap.close()
  }
}

const AVATAR_THUMB = 256
const AVATAR_MED = 512
const COVER_THUMB_MAX = 720
const COVER_MED_MAX = 1920

export type ProfileTwoVariantResult =
  | {
      kind: 'variants'
      thumb: Blob
      medium: Blob
      mime: string
      ext: string
      width: number
      height: number
    }
  | {
      kind: 'passthrough'
      blob: Blob
      ext: string
      mime: string
      width: number
      height: number
    }

export async function createProfileAvatarVariants(file: File): Promise<ProfileTwoVariantResult> {
  if (isPassthroughImageFile(file)) {
    let w = 0
    let h = 0
    try {
      const bitmap = await createImageBitmap(file)
      w = bitmap.width
      h = bitmap.height
      bitmap.close()
    } catch {
      /* ok */
    }
    const nl = file.name.toLowerCase()
    const ext = nl.endsWith('.gif') ? 'gif' : nl.endsWith('.svg') ? 'svg' : 'jpg'
    return {
      kind: 'passthrough',
      blob: file,
      ext,
      mime: file.type || 'image/jpeg',
      width: w,
      height: h,
    }
  }

  const bitmap = await createImageBitmap(file)
  try {
    const iw = bitmap.width
    const ih = bitmap.height
    const t = fitInside(iw, ih, AVATAR_THUMB)
    const m = fitInside(iw, ih, AVATAR_MED)
    const preferWebp = typeof HTMLCanvasElement.prototype.toBlob === 'function'
    const thumb = await drawToBlob(bitmap, t.w, t.h, preferWebp)
    const medium = await drawToBlob(bitmap, m.w, m.h, preferWebp)
    const ext = thumb.mime.includes('webp') ? 'webp' : 'jpg'
    return {
      kind: 'variants',
      thumb: thumb.blob,
      medium: medium.blob,
      mime: thumb.mime,
      ext,
      width: m.w,
      height: m.h,
    }
  } finally {
    bitmap.close()
  }
}

export async function createProfileCoverVariants(file: File): Promise<ProfileTwoVariantResult> {
  if (isPassthroughImageFile(file)) {
    let w = 0
    let h = 0
    try {
      const bitmap = await createImageBitmap(file)
      w = bitmap.width
      h = bitmap.height
      bitmap.close()
    } catch {
      /* ok */
    }
    const nl = file.name.toLowerCase()
    const ext = nl.endsWith('.gif') ? 'gif' : nl.endsWith('.svg') ? 'svg' : 'jpg'
    return {
      kind: 'passthrough',
      blob: file,
      ext,
      mime: file.type || 'image/jpeg',
      width: w,
      height: h,
    }
  }

  const bitmap = await createImageBitmap(file)
  try {
    const iw = bitmap.width
    const ih = bitmap.height
    const t = fitInside(iw, ih, COVER_THUMB_MAX)
    const m = fitInside(iw, ih, COVER_MED_MAX)
    const preferWebp = typeof HTMLCanvasElement.prototype.toBlob === 'function'
    const thumb = await drawToBlob(bitmap, t.w, t.h, preferWebp)
    const medium = await drawToBlob(bitmap, m.w, m.h, preferWebp)
    const ext = thumb.mime.includes('webp') ? 'webp' : 'jpg'
    return {
      kind: 'variants',
      thumb: thumb.blob,
      medium: medium.blob,
      mime: thumb.mime,
      ext,
      width: m.w,
      height: m.h,
    }
  } finally {
    bitmap.close()
  }
}
