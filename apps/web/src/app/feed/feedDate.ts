/** Timestamp bài tin — Việt Nam. */
export function formatFeedDt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Thời gian tương đối cho hàng bình luận (vd. "7 giờ", "3 ngày"). */
export function formatFeedRelativeVi(iso: string): string {
  try {
    const then = new Date(iso).getTime()
    const now = Date.now()
    const sec = Math.round((now - then) / 1000)
    if (sec < 45) return 'Vừa xong'
    const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })
    const min = Math.round(sec / 60)
    if (min < 60) return rtf.format(-min, 'minute')
    const hr = Math.round(min / 60)
    if (hr < 24) return rtf.format(-hr, 'hour')
    const day = Math.round(hr / 24)
    if (day < 30) return rtf.format(-day, 'day')
    const mo = Math.round(day / 30)
    if (mo < 12) return rtf.format(-mo, 'month')
    const yr = Math.round(day / 365)
    return rtf.format(-yr, 'year')
  } catch {
    return ''
  }
}
