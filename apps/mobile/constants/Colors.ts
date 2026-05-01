import { darkPalette, lightPalette } from '@/theme/palette'

/** Tích hợp @react-navigation + Themed.tsx */
export default {
  light: {
    text: lightPalette.ink,
    background: lightPalette.canvas,
    tint: lightPalette.accent,
    tabIconDefault: lightPalette.muted,
    tabIconSelected: lightPalette.accent,
    card: lightPalette.surfaceElevated,
  },
  dark: {
    text: darkPalette.ink,
    background: darkPalette.canvas,
    tint: darkPalette.accent,
    tabIconDefault: darkPalette.muted,
    tabIconSelected: darkPalette.accent,
    card: darkPalette.surfaceElevated,
  },
}
