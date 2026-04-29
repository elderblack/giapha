/**
 * Chuẩn hoá số di động Việt Nam sang E.164 (+84...).
 * Hỗ trợ: 0912345678, 84912345678, +84912345678, 912345678
 */
export function normalizeVnPhoneToE164(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null

  if (t.startsWith('+')) {
    if (!t.startsWith('+84')) return null
    const rest = t.slice(3).replace(/\D/g, '')
    if (rest.length < 9 || rest.length > 10) return null
    return `+84${rest}`
  }

  const digits = t.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 11 && digits.length <= 12) {
    return `+${digits}`
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+84${digits.slice(1)}`
  }
  if (digits.length === 9) {
    return `+84${digits}`
  }
  return null
}
