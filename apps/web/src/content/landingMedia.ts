/**
 * Ảnh landing phục vụ từ /public/landing (Vite copy sang dist) — không phụ thuộc CDN khi user mở trang.
 * Nguồn gốc: Unsplash (giấy phép https://unsplash.com/license). File: hero.jpg, features.jpg.
 */
export const landingMedia = {
  hero: {
    src: '/landing/hero.jpg',
    alt: 'Gia đình nhiều thế hệ chụp ảnh ngoài trời tại Quảng Nam, Việt Nam.',
    creditLabel: 'Fernandes Photographer / Unsplash',
    creditUrl: 'https://unsplash.com/photos/h8zP5HOBGBc',
  },
  featuresBanner: {
    src: '/landing/features.jpg',
    alt: 'Đèn lồng đêm phố cổ Hội An, Quảng Nam — không gian ấm, gần văn hoá họ hàng và lễ tiết Việt.',
    creditLabel: 'Steven Wilcox / Unsplash',
    creditUrl: 'https://unsplash.com/photos/mYNGbkIBIGM',
  },
} as const
