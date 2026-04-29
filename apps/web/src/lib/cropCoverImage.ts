/**
 * Xuất JPEG từ vùng cắt (pixel) — dùng với react-easy-crop (croppedAreaPixels).
 */
import type { Area } from 'react-easy-crop'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}

/** Cạnh dài nhất của ảnh xuất (px) để vừa đủ nét nhưng không quá nặng. */
const OUT_MAX_DIM = 2000

export async function blobFromCroppedArea(imageSrc: string, pixels: Area): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const { width: cw, height: ch, x: cx, y: cy } = pixels
  const scale = Math.min(OUT_MAX_DIM / cw, OUT_MAX_DIM / ch, 1)
  const w = Math.round(cw * scale)
  const h = Math.round(ch * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không có canvas.')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, cx, cy, cw, ch, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không tạo được ảnh.'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9,
    )
  })
}
