export function logMediaUploadMetric(payload: {
  context: string
  variant: string
  bytes: number
  mime?: string
}): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[media]', payload.context, payload.variant, payload.bytes, payload.mime ?? '')
  }
}
