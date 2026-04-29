import { Solar } from 'lunar-javascript'

/**
 * Quy đổi ngày dương (ISO `YYYY-MM-DD`) sang mô tả âm lịch (lịch Trung-Việt, cùng hệ tính toán thông dụng).
 * Tháng âm từ thư viện có thể âm khi là tháng nhuận.
 */
export function formatSolarIsoToLunarVi(iso: string): string | null {
  const t = iso.trim().slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  try {
    const solar = Solar.fromYmd(y, mo, d)
    const lunar = solar.getLunar()
    const ly = lunar.getYear()
    const lm = lunar.getMonth()
    const ld = lunar.getDay()
    const leap = lm < 0
    const absM = Math.abs(lm)
    const gz = lunar.getYearInGanZhi()
    const sx = lunar.getShengxiao()
    return `${ld}/${absM} âm lịch năm ${ly}${leap ? ' (tháng nhuận)' : ''} — ${gz} (${sx})`
  } catch {
    return null
  }
}
