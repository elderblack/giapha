import 'react-easy-crop/react-easy-crop.css'

import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Loader2, ZoomIn } from 'lucide-react'
import { blobFromCroppedArea } from '../../lib/cropCoverImage'
import { role } from '../../design/roles'

/** Tương tự tỷ lệ bìa phổ biến (≈ 820×312 px). */
const COVER_ASPECT = 820 / 312

type Props = {
  imageSrc: string
  onCancel: () => void
  onConfirm: (blob: Blob) => Promise<void>
  busy: boolean
}

export function CoverCropModal({ imageSrc, onCancel, onConfirm, busy }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const pixelsRef = useRef<Area | null>(null)
  const [pixelsReady, setPixelsReady] = useState(false)

  useEffect(() => {
    pixelsRef.current = null
    setPixelsReady(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }, [imageSrc])

  async function confirm() {
    const px = pixelsRef.current
    if (!px) return
    try {
      const blob = await blobFromCroppedArea(imageSrc, px)
      await onConfirm(blob)
    } catch {
      console.error('[CoverCropModal] blob export failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/[0.55] p-3 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (busy) return
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="relative max-h-[min(92vh,900px)] w-full max-w-[640px] overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-labelledby="cover-crop-title"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="border-b border-abnb-hairlineSoft px-5 py-4 sm:px-6">
          <h2 id="cover-crop-title" className={`${role.headingSection} text-[1.125rem]`}>
            Cắt ảnh bìa
          </h2>
          <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
            Kéo để căn chỉnh, hoặc dùng thu phóng. Khung có tỷ lệ cố định như bìa timeline.
          </p>
        </header>

        <div className="relative h-[clamp(240px,55vw,340px)] w-full bg-[#080808] sm:h-[360px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={COVER_ASPECT}
            showGrid={false}
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, areaPixels: Area) => {
              pixelsRef.current = areaPixels
              setPixelsReady(true)
            }}
          />
        </div>

        <div className="border-t border-abnb-hairlineSoft/85 bg-abnb-canvas/95 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-5 w-5 shrink-0 text-abnb-muted" strokeWidth={2} aria-hidden />
            <label className="flex min-w-0 flex-1 items-center gap-3">
              <span className={`${role.caption} shrink-0 text-abnb-body`}>Thu phóng</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-2 w-full min-w-0 cursor-pointer accent-abnb-primary"
              />
              <span className="tabular-nums text-[12px] font-semibold text-abnb-muted">{zoom.toFixed(1)}×</span>
            </label>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-abnb-hairlineSoft px-5 py-4 sm:px-6">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${role.btnSecondary} !min-h-[2.75rem] px-8 !text-[14px] disabled:opacity-50`}
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy || !pixelsReady}
            onClick={() => void confirm()}
            className={`${role.btnPrimary} !inline-flex min-h-[2.75rem] items-center gap-2 !px-8 !text-[14px] disabled:opacity-50`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lưu ảnh bìa
          </button>
        </footer>
      </div>
    </div>
  )
}
