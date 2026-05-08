const POSTER_MAX_WIDTH = 720
const JPEG_QUALITY = 0.72

/**
 * Lấy một khung hình từ video file (local) làm poster JPEG.
 */
export async function createVideoPosterBlob(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = url

    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error('timeout')), 25_000)
      video.onloadedmetadata = () => {
        window.clearTimeout(to)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(to)
        reject(new Error('video'))
      }
    })

    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
    const seekTime = Math.min(0.15, dur * 0.05)
    video.currentTime = seekTime

    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error('seek')), 15_000)
      video.onseeked = () => {
        window.clearTimeout(to)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(to)
        reject(new Error('seek'))
      }
    })

    const vw = video.videoWidth || 1
    const vh = video.videoHeight || 1
    const scale = Math.min(POSTER_MAX_WIDTH / vw, 1)
    const cw = Math.max(1, Math.round(vw * scale))
    const ch = Math.max(1, Math.round(vh * scale))

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, cw, ch)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY),
    )
    return blob
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
