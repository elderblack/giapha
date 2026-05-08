/** Ghi nhận kích thước upload (dev / tùy chỉnh sau). */
export function logMediaUploadMetric(payload: {
  context: string
  variant: string
  bytes: number
  mime?: string
}): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[media]', payload.context, payload.variant, payload.bytes, payload.mime ?? '')
  }
}
