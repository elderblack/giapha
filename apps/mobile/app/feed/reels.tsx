import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { FeedReelItem } from '@/components/feed/FeedReelItem'
import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { loadFeedTree, reloadFeedPostsByIds, type FeedPostState } from '@/lib/feed/feedQueries'
import { getUserFamilyTreeId } from '@/lib/familyTreeMembership'
import { getSupabase, hasSupabaseCredentials } from '@/lib/supabase'
import { Font } from '@/theme/typography'

export default function FeedReelsScreen() {
  const router = useRouter()
  const { startId } = useLocalSearchParams<{ startId?: string }>()
  const { height: winH } = useWindowDimensions()
  const { user } = useAuth()
  const sb = getSupabase()
  const p = usePalette()

  const [posts, setPosts] = useState<FeedPostState[]>([])
  const [treeId, setTreeId] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const listRef = useRef<FlatList<FeedPostState>>(null)
  const didScrollInitRef = useRef(false)

  useEffect(() => {
    didScrollInitRef.current = false
  }, [startId])

  const videoPosts = useMemo(
    () => posts.filter((x) => x.media.some((m) => m.media_kind === 'video')),
    [posts],
  )

  const initialIndex = useMemo(() => {
    const sid = typeof startId === 'string' ? startId : Array.isArray(startId) ? startId[0] : undefined
    if (!sid) return 0
    const i = videoPosts.findIndex((x) => x.id === sid)
    return i >= 0 ? i : 0
  }, [startId, videoPosts])

  useEffect(() => {
    if (!sb || !user?.id || !hasSupabaseCredentials()) {
      setTreeId(null)
      setPosts([])
      setBooting(false)
      return
    }
    let cancelled = false
    void (async () => {
      const tid = await getUserFamilyTreeId(sb, user.id)
      if (cancelled) return
      setTreeId(tid)
      if (tid) {
        try {
          const next = await loadFeedTree(tid)
          if (!cancelled) setPosts(next)
        } catch {
          if (!cancelled) setPosts([])
        }
      } else {
        setPosts([])
      }
      if (!cancelled) setBooting(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, user?.id])

  useEffect(() => {
    if (!videoPosts.length) {
      setActiveId(null)
      return
    }
    setActiveId((prev) => {
      if (prev && videoPosts.some((x) => x.id === prev)) return prev
      return videoPosts[initialIndex]?.id ?? videoPosts[0]!.id
    })
  }, [videoPosts, initialIndex])

  useEffect(() => {
    if (booting || !videoPosts.length || didScrollInitRef.current) return
    if (initialIndex <= 0) return
    didScrollInitRef.current = true
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false })
    })
  }, [booting, videoPosts.length, initialIndex])

  const reloadPost = useCallback(async (postId: string) => {
    const m = await reloadFeedPostsByIds([postId])
    const next = m.get(postId)
    if (next) setPosts((prev) => prev.map((x) => (x.id === postId ? next : x)))
  }, [])

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: FeedPostState; isViewable?: boolean | null }[] }) => {
      const row = viewableItems.find((x) => x.isViewable)
      const id = row?.item?.id
      if (typeof id === 'string') setActiveId(id)
    },
  ).current

  const viewConfig = useRef({ itemVisiblePercentThreshold: 78 }).current

  const getItemLayout = useCallback(
    (_d: ArrayLike<FeedPostState> | null | undefined, index: number) => ({
      length: winH,
      offset: winH * index,
      index,
    }),
    [winH],
  )

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: false })
    }, 180)
  }, [])

  if (!hasSupabaseCredentials()) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <StatusBar style="light" />
        <Text style={{ color: '#fff', fontFamily: Font.medium }}>Chưa cấu hình Supabase.</Text>
      </View>
    )
  }

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={p.accent} />
      </View>
    )
  }

  if (booting) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={p.accent} size="large" />
      </View>
    )
  }

  if (!treeId) {
    return (
      <View style={[styles.center, { backgroundColor: '#000', padding: 24 }]}>
        <StatusBar style="light" />
        <Pressable style={styles.fabBack} onPress={() => router.back()} hitSlop={14}>
          <FontAwesome name="chevron-down" size={24} color="#FFF" />
        </Pressable>
        <Text style={{ color: '#fff', fontFamily: Font.semiBold, fontSize: 17, textAlign: 'center' }}>
          Chưa có dòng họ để xem clip.
        </Text>
      </View>
    )
  }

  if (!videoPosts.length) {
    return (
      <View style={[styles.center, { backgroundColor: '#000', padding: 24 }]}>
        <StatusBar style="light" />
        <Pressable style={styles.fabBack} onPress={() => router.back()} hitSlop={14}>
          <FontAwesome name="chevron-down" size={24} color="#FFF" />
        </Pressable>
        <Text style={{ color: '#fff', fontFamily: Font.semiBold, fontSize: 17, textAlign: 'center' }}>
          Chưa có video trong bảng tin dòng họ.
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontFamily: Font.regular,
            marginTop: 10,
            textAlign: 'center',
            lineHeight: 22,
          }}
        >
          Đăng clip từ ô «Ảnh» hoặc «Clip» trên Trang nhà, rồi lướt dọc tại đây.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <StatusBar style="light" />
      <FlatList
        ref={listRef}
        data={videoPosts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedReelItem
            post={item}
            height={winH}
            isActive={item.id === activeId}
            currentUserId={user.id}
            onComments={() => router.push(`/feed/${item.id}`)}
            onBack={() => router.back()}
            onAfterReact={() => void reloadPost(item.id)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={winH}
        snapToAlignment="start"
        disableIntervalMomentum
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabBack: {
    position: 'absolute',
    top: 54,
    left: 14,
    zIndex: 20,
    padding: 8,
  },
})
