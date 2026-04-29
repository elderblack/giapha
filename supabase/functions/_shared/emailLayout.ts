/** Khung HTML email giao dịch (GiaPhả) — dùng chung các Edge Function gửi Resend. */

export function escapeHtml (s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type TransactionalEmailParts = {
  /** Tiêu đề hiển thị trong khối hero */
  title: string
  /** Một dòng tóm tắt (một phần client hiển thị ở preview) */
  preheader: string
  /** Đoạn HTML nội dung chính (đã escape nếu cần) */
  innerHtml: string
  /** Liên kết CTA tuyến tính; optional */
  primaryUrl?: string
  primaryLabel?: string
  /** Gốc site production, vd. https://giapha.vn — hiện ở footer */
  siteUrl: string
}

/** full HTML document cho Resend `html` */
export function buildTransactionalEmail (p: TransactionalEmailParts): string {
  const pre = escapeHtml(p.preheader)
  const title = escapeHtml(p.title)
  const footer = escapeHtml(p.siteUrl.replace(/\/$/, ''))
  const cta =
    p.primaryUrl && p.primaryLabel
      ? `<p style="margin:24px 0 0 0;"><a href="${p.primaryUrl.replace(/"/g, '%22')}" style="display:inline-block;padding:12px 22px;background:#111827;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:600;font-size:15px;">${escapeHtml(p.primaryLabel)}</a></p>`
      : ''
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0">${pre}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 10px 40px rgba(0,0,0,.06);">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;">GiaPhả</p>
<h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.25;color:#111827;">${title}</h1>
</td></tr>
<tr><td style="padding:8px 28px 28px 28px;font-size:16px;line-height:1.6;color:#374151;">
${p.innerHtml}
${cta}
</td></tr>
<tr><td style="padding:20px 28px;background:#fafafa;border-top:1px solid #f4f4f5;font-size:13px;line-height:1.5;color:#6b7280;">
<p style="margin:0;">Trân trọng,<br/><strong>GiaPhả</strong></p>
<p style="margin:12px 0 0 0;"><a href="${footer.replace(/"/g, '%22')}" style="color:#2563eb;text-decoration:none;">${footer}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

/** Đọc URL site cho liên kết trong email; bắt buộc cấu hình trên production. */
export function publicSiteUrlFromEnv (): string {
  const raw = Deno.env.get('PUBLIC_SITE_URL')?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return 'http://127.0.0.1:5173'
}
