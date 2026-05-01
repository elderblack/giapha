import { useMemo } from 'react'

import { useColorScheme } from '@/components/useColorScheme'
import { getPalette, type ThemePalette } from '@/theme/palette'

export function usePalette(): ThemePalette & { scheme: 'light' | 'dark' } {
  const colorScheme = useColorScheme()
  const scheme = colorScheme === 'dark' ? 'dark' : 'light'

  return useMemo(() => {
    const p = getPalette(scheme)
    return { ...p, scheme }
  }, [scheme])
}
