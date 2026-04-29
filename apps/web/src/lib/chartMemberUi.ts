/** Dùng cho SVG id / clipPath — tránh ký tự không hợp lệ */
export function chartNodeDomId(memberId: string, prefix: string): string {
  return `${prefix}-${memberId.replace(/[^a-zA-Z0-9_-]/g, '')}`
}
