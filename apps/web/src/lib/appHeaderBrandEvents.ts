/** Tên thương hiệu mặc định (header app, trang marketing, v.v.). */
export const APP_DISPLAY_NAME = 'Cội Nguồn'

/** Logo mặc định trong `public/logo.png` — favicon, landing, fallback header app. */
export const APP_LOGO_URL = '/logo.png'

/** Kích hoạt `useAppHeaderBrand` tải lại sau khi chủ dòng cập nhật logo/tên. */
export const APP_HEADER_BRAND_REFRESH_EVENT = 'giapha:app-header-brand-refresh'

export function dispatchAppHeaderBrandRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(APP_HEADER_BRAND_REFRESH_EVENT))
}
