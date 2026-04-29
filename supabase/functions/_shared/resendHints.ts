/** Gợi ý tiếng Việt khi Resend trả lỗi (domain thử nghiệm, chưa xác minh, v.v.) */

export function resendFailureHintVi(status: number, bodyText: string): string {
  const t = bodyText.toLowerCase()
  if (
    status === 403 &&
    (t.includes('testing domain') ||
      t.includes('verify a domain') ||
      t.includes('resend.dev'))
  ) {
    return (
      'Resend (onboarding@resend.dev) chỉ gửi được tới email tài khoản Resend. ' +
      'Để gửi cho người dùng: xác minh domain tại resend.com → đặt secret RESEND_FROM_EMAIL ' +
      '(vd. GiaPhả <noreply@ten-mien-cua-ban.com>).'
    )
  }
  if (status === 422 || status === 400) {
    return (
      'Cấu hình email gửi đi không hợp lệ. Kiểm tra RESEND_FROM_EMAIL khớp domain đã xác minh trên Resend.'
    )
  }
  return 'Không gửi được email qua Resend. Kiểm tra RESEND_API_KEY và domain.'
}
