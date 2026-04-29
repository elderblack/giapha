/** Tên gọi trong placeholder kiểu Facebook ("Tên ơi, ...") — ưu tiên từ cuối nếu có nhiều từ. */
export function firstNameHint(fullName: string): string {
  const p = fullName.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 2) return p[p.length - 1] ?? 'bạn'
  return p[0] ?? 'bạn'
}
