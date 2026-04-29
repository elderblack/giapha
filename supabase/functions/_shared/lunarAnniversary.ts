import { DateTime } from 'https://esm.sh/luxon@3.5.0'
import { Lunar, Solar } from 'https://esm.sh/lunar-javascript@1.7.7'

export type Ymd = { y: number; m: number; d: number }

function parseSolarIso(iso: string): Ymd | null {
  const t = iso.trim().slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return { y, m: mo, d }
}

/**
 * Ngày dương của kỷ niệm âm (tháng + ngày âm từ ngày mất dương) trong một **năm âm lịch**.
 * Tháng âm có thể âm (tháng nhuận); nếu năm đó không có tháng nhuận đó → thử tháng không nhuận cùng số.
 */
export function lunarAnniversarySolarInLunarYear(
  lunarYear: number,
  monthSigned: number,
  lunarDay: number,
): Ymd | null {
  const tryOne = (ly: number, m: number): Ymd | null => {
    try {
      const sol = Lunar.fromYmd(ly, m, lunarDay).getSolar()
      return { y: sol.getYear(), m: sol.getMonth(), d: sol.getDay() }
    } catch {
      return null
    }
  }
  let r = tryOne(lunarYear, monthSigned)
  if (r) return r
  if (monthSigned < 0) {
    r = tryOne(lunarYear, Math.abs(monthSigned))
    if (r) return r
  }
  return null
}

/**
 * Hôm nay (`today`, giờ VN) có phải ngày nhắc (trước N ngày so với kỷ niệm âm) không.
 * Dò năm âm todayLunar ± 1 để bao phủ cận Tết.
 */
export function isLunarMemorialNotifyDay(
  deathSolarIso: string,
  daysBefore: number,
  today: Ymd,
): boolean {
  const death = parseSolarIso(deathSolarIso)
  if (!death) return false
  const deathLunar = Solar.fromYmd(death.y, death.m, death.d).getLunar()
  const lm = deathLunar.getMonth()
  const ld = deathLunar.getDay()

  const todayLunar = Solar.fromYmd(today.y, today.m, today.d).getLunar()
  const baseLy = todayLunar.getYear()

  const tdt = DateTime.fromObject(
    { year: today.y, month: today.m, day: today.d },
    { zone: 'Asia/Ho_Chi_Minh' },
  ).startOf('day')
  if (!tdt.isValid) return false

  for (const delta of [-1, 0, 1]) {
    const ann = lunarAnniversarySolarInLunarYear(baseLy + delta, lm, ld)
    if (!ann) continue
    const annDt = DateTime.fromObject(
      { year: ann.y, month: ann.m, day: ann.d },
      { zone: 'Asia/Ho_Chi_Minh' },
    ).startOf('day')
    if (!annDt.isValid) continue
    const notify = annDt.minus({ days: daysBefore })
    if (notify.hasSame(tdt, 'day')) return true
  }
  return false
}
