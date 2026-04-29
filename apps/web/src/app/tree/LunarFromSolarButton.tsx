import { Sparkles } from 'lucide-react'
import { role } from '../../design/roles'
import { formatSolarIsoToLunarVi } from '../../lib/solarToLunarVi'

type LunarFromSolarButtonProps = {
  solarIso: string
  onApply: (lunarText: string) => void
}

export function LunarFromSolarButton({ solarIso, onApply }: LunarFromSolarButtonProps) {
  const preview = formatSolarIsoToLunarVi(solarIso)
  const disabled = !preview
  return (
    <button
      type="button"
      disabled={disabled}
      title={
        preview
          ? `Điền: ${preview}`
          : 'Chọn đủ ngày dương (YYYY-MM-DD) để quy đổi'
      }
      onClick={() => {
        if (preview) onApply(preview)
      }}
      className={`inline-flex items-center gap-1 text-[13px] font-semibold disabled:opacity-40 disabled:pointer-events-none ${
        disabled ? 'text-abnb-muted' : `${role.link} !no-underline text-abnb-primary hover:text-abnb-primary/90`
      }`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      Từ ngày dương
    </button>
  )
}
