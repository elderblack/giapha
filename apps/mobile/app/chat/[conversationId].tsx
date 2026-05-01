import FontAwesome from '@expo/vector-icons/FontAwesome'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import type { KeyboardAvoidingViewProps } from 'react-native'

import { Text } from '@/components/Themed'
import { useAuth } from '@/context/useAuth'
import { usePalette } from '@/hooks/usePalette'
import { markFamilyChatConversationRead } from '@/lib/chat/markRead'
import type { ChatMessage } from '@/lib/chat/types'
import { uploadChatImageMobile } from '@/lib/chat/uploadChatImageMobile'
import { getSupabase } from '@/lib/supabase'
import { useChatAttachmentUrl } from '@/hooks/useChatAttachmentUrl'
import { Font } from '@/theme/typography'

export default function ChatConversationScreen() {
  const p = usePalette()
  const { user } = useAuth()
  const sb = getSupabase()
  const uid = user?.id
  const raw = useLocalSearchParams<{ conversationId: string | string[] }>()
  const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : raw.conversationId?.[0]

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [convTitle, setConvTitle] = useState('Đoạn chat')
  const [profileByUserId, setProfileByUserId] = useState<
    Record<string, { full_name: string; avatar_url: string | null }>
  >({})
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null)
  const listRef = useRef<FlatList<ChatMessage>>(null)

  const kbBehavior: KeyboardAvoidingViewProps['behavior'] =
    Platform.OS === 'ios' ? 'padding' : undefined

  const loadTitles = useCallback(async () => {
    if (!sb || !uid || !conversationId) return
    const { data: convRow } = await sb.from('family_chat_conversations').select('kind,title').eq('id', conversationId).maybeSingle()
    const kindRaw = (convRow as { kind?: string } | null)?.kind
    const isGroup = kindRaw === 'group'
    const title = (convRow as { title?: string | null } | null)?.title?.trim()

    const { data: parts } = await sb.from('family_chat_participants').select('user_id').eq('conversation_id', conversationId)
    const userIds = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id)

    if (uid) {
      const { data: meRow } = await sb.from('profiles').select('avatar_url').eq('id', uid).maybeSingle()
      setMyAvatarUrl((meRow as { avatar_url?: string | null } | null)?.avatar_url ?? null)
    }

    if (isGroup) {
      setConvTitle(title || 'Nhóm')
      if (userIds.length) {
        const { data: profs } = await sb.from('profiles').select('id,full_name,avatar_url').in('id', userIds)
        const map: Record<string, { full_name: string; avatar_url: string | null }> = {}
        for (const row of (profs ?? []) as { id: string; full_name: string; avatar_url: string | null }[]) {
          map[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url }
        }
        setProfileByUserId(map)
      }
      return
    }

    const otherId = userIds.find((id) => id !== uid)
    if (otherId) {
      const { data: prof } = await sb.from('profiles').select('full_name,avatar_url').eq('id', otherId).maybeSingle()
      const pr = prof as { full_name?: string; avatar_url?: string | null } | null
      const nm = typeof pr?.full_name === 'string' ? pr.full_name : 'Người dùng'
      setConvTitle(nm)
      setProfileByUserId({ [otherId]: { full_name: nm, avatar_url: pr?.avatar_url ?? null } })
    } else {
      setConvTitle('Tin nhắn')
    }
  }, [sb, uid, conversationId])

  const loadMessages = useCallback(async () => {
    if (!sb || !conversationId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await sb
      .from('family_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    const list = (data as ChatMessage[]) ?? []
    setMessages(list)
    setLoading(false)

    const senders = [...new Set(list.map((m) => m.sender_id))].filter(Boolean)
    if (sb && senders.length) {
      const { data: profs } = await sb.from('profiles').select('id,full_name,avatar_url').in('id', senders)
      setProfileByUserId((prev) => {
        const next = { ...prev }
        for (const row of (profs ?? []) as { id: string; full_name: string; avatar_url: string | null }[]) {
          next[row.id] = { full_name: row.full_name, avatar_url: row.avatar_url }
        }
        return next
      })
    }
  }, [sb, conversationId])

  useFocusEffect(
    useCallback(() => {
      void loadTitles()
      void loadMessages()
      if (sb && uid && conversationId) {
        void markFamilyChatConversationRead(sb, uid, conversationId)
      }
    }, [loadTitles, loadMessages, sb, uid, conversationId]),
  )

  useEffect(() => {
    if (!sb || !uid || !conversationId) return
    const client = sb
    const participantId = uid
    const conv = conversationId
    const ch = client
      .channel(`mobile-chat-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          const sid = msg.sender_id
          if (sid) {
            void (async () => {
              const { data: row } = await client
                .from('profiles')
                .select('id,full_name,avatar_url')
                .eq('id', sid)
                .maybeSingle()
              const r = row as { id: string; full_name: string; avatar_url: string | null } | null
              if (!r) return
              setProfileByUserId((prev) => (prev[sid] ? prev : { ...prev, [sid]: { full_name: r.full_name, avatar_url: r.avatar_url } }))
            })()
          }
          void markFamilyChatConversationRead(client, participantId, conv)
        },
      )
      .subscribe()
    return () => void client.removeChannel(ch)
  }, [sb, uid, conversationId])

  async function sendText() {
    if (!sb || !uid || !conversationId) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    const { error } = await sb.from('family_chat_messages').insert({
      conversation_id: conversationId,
      sender_id: uid,
      body: text,
    })
    setSending(false)
    if (error) return
    setDraft('')
  }

  async function pickAndSendImage() {
    if (!sb || !uid || !conversationId || sending) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Quyền truy cập', 'Cần quyền thư viện ảnh để gửi hình trong chat.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.92,
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets[0]?.uri) return
    let uri = result.assets[0].uri.trim()
    let mime = result.assets[0].mimeType ?? null
    try {
      const out = await manipulateAsync(uri, [], { compress: 0.9, format: SaveFormat.JPEG })
      uri = out.uri
      mime = 'image/jpeg'
    } catch {
      /* giữ URI gốc */
    }

    setSending(true)
    const up = await uploadChatImageMobile({
      conversationId,
      userId: uid,
      fileUri: uri,
      mimeHint: mime,
    })
    if (!up.ok) {
      setSending(false)
      Alert.alert('Không gửi được ảnh', up.error)
      return
    }
    const { error } = await sb.from('family_chat_messages').insert({
      conversation_id: conversationId,
      sender_id: uid,
      attachment_path: up.storagePath,
      attachment_kind: 'image',
    })
    setSending(false)
    if (error) {
      Alert.alert('Không gửi được ảnh', error.message)
    }
  }

  if (!conversationId) {
    return (
      <View style={[styles.center, { backgroundColor: p.canvas }]}>
        <Text style={{ fontFamily: Font.medium, color: p.muted }}>Thiếu mã hội thoại.</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: convTitle }} />
      <KeyboardAvoidingView style={[styles.flex, { backgroundColor: p.canvas }]} behavior={kbBehavior}>
        {loading ? (
          <View style={styles.flexCenter}>
            <ActivityIndicator color={p.accent} size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.flex}
            contentContainerStyle={styles.threadPad}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const prof = item.sender_id ? profileByUserId[item.sender_id] : undefined
              const isMine = item.sender_id === uid
              return (
                <MessageBubble
                  msg={item}
                  isMine={isMine}
                  senderName={prof?.full_name}
                  senderAvatarUrl={isMine ? myAvatarUrl : prof?.avatar_url ?? null}
                  p={p}
                />
              )
            }}
          />
        )}
        <View style={[styles.composerRow, { borderTopColor: p.border, backgroundColor: p.surfaceElevated }]}>
          <Pressable
            accessibilityLabel="Gửi ảnh"
            hitSlop={8}
            onPress={() => void pickAndSendImage()}
            disabled={sending}
            style={[styles.attachBtn, { opacity: sending ? 0.45 : 1 }]}
          >
            <FontAwesome name="image" size={22} color={p.accent} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhập tin nhắn…"
            placeholderTextColor={p.muted}
            style={[styles.input, { color: p.ink, fontFamily: Font.regular, backgroundColor: p.canvasMuted }]}
            multiline
            maxLength={4000}
            editable={!sending}
          />
          <Pressable
            accessibilityLabel="Gửi tin nhắn"
            onPress={() => void sendText()}
            disabled={sending || !draft.trim()}
            style={[styles.sendBtn, { backgroundColor: p.accent, opacity: sending || !draft.trim() ? 0.45 : 1 }]}
          >
            <FontAwesome name="send" size={16} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

function MessageBubble(props: {
  msg: ChatMessage
  isMine: boolean
  senderName?: string
  senderAvatarUrl?: string | null
  p: ReturnType<typeof usePalette>
}) {
  const { msg, isMine, senderName, senderAvatarUrl, p } = props
  const bg = isMine ? p.accent : p.canvasMuted
  const imgUri = useChatAttachmentUrl(
    msg.attachment_kind === 'image' ? msg.attachment_path : null,
  )

  const avatar = (
    <View style={[styles.msgAvatarWrap, { backgroundColor: p.accentMuted }]}>
      {senderAvatarUrl ? (
        <Image source={{ uri: senderAvatarUrl }} style={styles.msgAvatarImg} />
      ) : (
        <FontAwesome name="user" size={14} color={p.accent} />
      )}
    </View>
  )

  const bubble = (
    <View style={[styles.bubbleOuter, { backgroundColor: bg }, isMine ? styles.bubbleTailMine : styles.bubbleTailTheirs]}>
      {!isMine && senderName ? (
        <Text style={[styles.metaName, { color: p.muted, fontFamily: Font.semiBold }]}>{senderName}</Text>
      ) : null}
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={styles.bubbleImg} resizeMode="cover" />
      ) : null}
      {msg.body?.trim() ? (
        <Text style={[styles.bubbleTxt, { color: isMine ? '#FFF' : p.ink, fontFamily: Font.regular }]}>{msg.body.trim()}</Text>
      ) : null}
      {!msg.body?.trim() && msg.attachment_kind === 'image' && !imgUri ? (
        <Text style={[styles.bubbleTxt, { color: isMine ? '#FFF' : p.muted, fontFamily: Font.regular }]}>[Ảnh]</Text>
      ) : null}
    </View>
  )

  if (isMine) {
    return (
      <View style={styles.msgRowMine}>
        <View style={styles.msgBubbleShrink}>{bubble}</View>
        {avatar}
      </View>
    )
  }
  return (
    <View style={styles.msgRowTheirs}>
      {avatar}
      <View style={styles.msgBubbleShrink}>{bubble}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  threadPad: { paddingVertical: 14, paddingHorizontal: 12, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  msgRowTheirs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '100%',
  },
  msgRowMine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    gap: 8,
    maxWidth: '100%',
    justifyContent: 'flex-end',
  },
  msgBubbleShrink: { flexShrink: 1, maxWidth: '78%' },
  msgAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarImg: { width: '100%', height: '100%' },
  bubbleOuter: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleTailMine: { borderBottomRightRadius: 4 },
  bubbleTailTheirs: { borderBottomLeftRadius: 4 },
  metaName: { fontSize: 11.5, marginBottom: 4 },
  bubbleTxt: { fontSize: 15, lineHeight: 21 },
  bubbleImg: { width: 210, height: 150, borderRadius: 12, marginBottom: 6 },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    borderRadius: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  attachBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
})
