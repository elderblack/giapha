import { type ReactNode, useEffect, useRef } from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'

import { usePalette } from '@/hooks/usePalette'

function usePulseOpacity() {
  const anim = useRef(new Animated.Value(0.42)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.42, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [anim])
  return anim
}

export function SkeletonBone({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  const p = usePalette()
  const opacityAnim = usePulseOpacity()
  const bg = p.scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)'

  return (
    <Animated.View style={[{ opacity: opacityAnim, backgroundColor: bg, overflow: 'hidden' }, style]}>
      {children}
    </Animated.View>
  )
}
