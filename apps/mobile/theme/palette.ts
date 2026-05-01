/** Bảng màu tĩnh: gốc không gian đăng nhập + mạng xã hội (accent rose-coral của Gia Phả). */
export type ThemePalette = {
  canvas: string
  canvasMuted: string
  surface: string
  surfaceElevated: string
  ink: string
  inkMuted: string
  muted: string
  accent: string
  accentMuted: string
  accentGlow: string
  border: string
  shadow: string
  danger: string
  success: string
}

export const lightPalette: ThemePalette = {
  canvas: '#F4F6F9',
  canvasMuted: '#E8ECF2',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  ink: '#0F172A',
  inkMuted: '#334155',
  muted: '#64748B',
  accent: '#FF385C',
  accentMuted: 'rgba(255, 56, 92, 0.12)',
  accentGlow: 'rgba(255, 56, 92, 0.18)',
  border: 'rgba(15, 23, 42, 0.08)',
  shadow: 'rgba(15, 23, 42, 0.12)',
  danger: '#DC2626',
  success: '#059669',
}

export const darkPalette: ThemePalette = {
  canvas: '#0B0F14',
  canvasMuted: '#121820',
  surface: '#121820',
  surfaceElevated: '#181F2A',
  ink: '#F1F5F9',
  inkMuted: '#CBD5E1',
  muted: '#94A3B8',
  accent: '#FF6B82',
  accentMuted: 'rgba(255, 107, 130, 0.15)',
  accentGlow: 'rgba(255, 107, 130, 0.22)',
  border: 'rgba(255, 255, 255, 0.09)',
  shadow: '#000000',
  danger: '#F87171',
  success: '#34D399',
}

export type ColorSchemeName = 'light' | 'dark'

export function getPalette(scheme: ColorSchemeName): ThemePalette {
  return scheme === 'dark' ? darkPalette : lightPalette
}
