-- Phase 5 — Chat realtime DM (1-1 giữa bạn bè đã chấp nhận).
--
-- ROLLBACK (ngược thứ tự):
--   DROP POLICY ... ON storage.objects (family-chat-media);
--   DELETE FROM storage.buckets WHERE id = 'family-chat-media';
--   DROP POLICY ... ON family_chat_messages / family_chat_participants / family_chat_conversations;
--   DROP TRIGGER family_chat_messages_notify_trg ON family_chat_messages;
--   DROP FUNCTION family_chat_notify_new_message();
--   DROP TRIGGER family_chat_messages_update_last_trg ON family_chat_messages;
--   DROP FUNCTION family_chat_update_last_message_at();
--   DROP FUNCTION family_chat_dm_peer_id(uuid, uuid);
--   DROP FUNCTION family_chat_is_participant(uuid, uuid);
--   DROP FUNCTION family_chat_open_dm(uuid);
--   DROP TABLE family_chat_messages;
--   DROP TABLE family_chat_participants;
--   DROP TABLE family_chat_conversations;
--   DROP POLICY "profiles_select_if_friend" ON profiles;

-- ---------------------------------------------------------------------------
-- 0. Profile visibility cho bạn bè (khác dòng họ vẫn xem được hồ sơ)
-- ---------------------------------------------------------------------------

CREATE POLICY "profiles_select_if_friend"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_friendships f
      WHERE (f.user_low = auth.uid() AND f.user_high = profiles.id)
         OR (f.user_low = profiles.id AND f.user_high = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_chat_participants (
  conversation_id UUID NOT NULL REFERENCES public.family_chat_conversations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_chat_participants_user
  ON public.family_chat_participants (user_id);

CREATE TABLE IF NOT EXISTS public.family_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.family_chat_conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT,
  attachment_path TEXT,
  attachment_kind TEXT CHECK (attachment_kind IS NULL OR attachment_kind IN ('image')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_chat_messages_content_ck CHECK (
    (body IS NOT NULL AND LENGTH(TRIM(body)) > 0) OR attachment_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_family_chat_messages_conv_created
  ON public.family_chat_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_chat_messages_sender
  ON public.family_chat_messages (sender_id);

-- ---------------------------------------------------------------------------
-- 2. Trigger: cập nhật last_message_at khi có tin mới
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.family_chat_update_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.family_chat_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER family_chat_messages_update_last_trg
  AFTER INSERT ON public.family_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.family_chat_update_last_message_at();

-- ---------------------------------------------------------------------------
-- 3. RPC: mở / tìm thread DM giữa hai bạn bè
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.family_chat_open_dm(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_conv_id UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF other_user_id IS NULL OR other_user_id = v_me THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;

  -- Kiểm tra friendship
  IF NOT EXISTS (
    SELECT 1 FROM public.family_friendships
    WHERE user_low = LEAST(v_me, other_user_id)
      AND user_high = GREATEST(v_me, other_user_id)
  ) THEN
    RAISE EXCEPTION 'not_friends';
  END IF;

  -- Tìm DM đã có giữa 2 người
  SELECT p1.conversation_id INTO v_conv_id
  FROM public.family_chat_participants p1
  INNER JOIN public.family_chat_participants p2
    ON p1.conversation_id = p2.conversation_id
  INNER JOIN public.family_chat_conversations c
    ON c.id = p1.conversation_id
  WHERE p1.user_id = v_me
    AND p2.user_id = other_user_id
    AND c.kind = 'dm'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Tạo mới
  INSERT INTO public.family_chat_conversations (kind)
  VALUES ('dm')
  RETURNING id INTO v_conv_id;

  INSERT INTO public.family_chat_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_me), (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Trigger: thông báo tin nhắn mới (ghi family_notifications)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.family_chat_notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
BEGIN
  FOR v_recipient IN
    SELECT user_id
    FROM public.family_chat_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.family_notifications (user_id, kind, payload)
    VALUES (
      v_recipient,
      'chat_message',
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'from_id', NEW.sender_id
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER family_chat_messages_notify_trg
  AFTER INSERT ON public.family_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.family_chat_notify_new_message();

-- ---------------------------------------------------------------------------
-- 4b. RLS helpers — đọc family_chat_participants mà không kích hoạt RLS lồng (đệ quy vô hạn)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.family_chat_is_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_chat_participants
    WHERE conversation_id = p_conversation_id
      AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.family_chat_is_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_chat_is_participant(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.family_chat_dm_peer_id(p_conversation_id uuid, p_me uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  (SELECT user_id
   FROM public.family_chat_participants
   WHERE conversation_id = p_conversation_id
     AND user_id <> p_me
   LIMIT 1);
$$;

REVOKE ALL ON FUNCTION public.family_chat_dm_peer_id(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_chat_dm_peer_id(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_chat_messages ENABLE ROW LEVEL SECURITY;

-- conversations: SELECT cho participant
CREATE POLICY "chat_conv_select_participant"
  ON public.family_chat_conversations FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(id, auth.uid()));

-- participants: SELECT nếu user là thành viên cùng conversation
CREATE POLICY "chat_part_select_same_conv"
  ON public.family_chat_participants FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(conversation_id, auth.uid()));

-- participants: UPDATE chỉ dòng của mình (last_read_at)
CREATE POLICY "chat_part_update_own"
  ON public.family_chat_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- messages: SELECT cho participant
CREATE POLICY "chat_msg_select_participant"
  ON public.family_chat_messages FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(conversation_id, auth.uid()));

-- messages: INSERT — sender_id = auth.uid(), phải là participant, phải là bạn với người kia
CREATE POLICY "chat_msg_insert_participant_friend"
  ON public.family_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.family_chat_is_participant(conversation_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.family_friendships fr
      WHERE fr.user_low = LEAST(
        auth.uid(),
        public.family_chat_dm_peer_id(conversation_id, auth.uid())
      )
        AND fr.user_high = GREATEST(
          auth.uid(),
          public.family_chat_dm_peer_id(conversation_id, auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Storage bucket: family-chat-media
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('family-chat-media', 'family-chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: participant có thể xem file trong conversation_id (segment 1)
CREATE POLICY "chat_media_select_participant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'family-chat-media'
    AND public.family_chat_is_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- INSERT: user upload vào folder mình (segment 2 = uid) trong conv (segment 1) mà mình là participant
CREATE POLICY "chat_media_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'family-chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.family_chat_is_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- DELETE: chỉ file của chính mình
CREATE POLICY "chat_media_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'family-chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 7. Realtime publication
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
