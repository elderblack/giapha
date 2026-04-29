-- Fix: infinite recursion trong RLS của family_chat_participants
-- (policy SELECT lại query chính bảng đó → PostgREST 500).

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

DROP POLICY IF EXISTS "chat_conv_select_participant" ON public.family_chat_conversations;
CREATE POLICY "chat_conv_select_participant"
  ON public.family_chat_conversations FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(id, auth.uid()));

DROP POLICY IF EXISTS "chat_part_select_same_conv" ON public.family_chat_participants;
CREATE POLICY "chat_part_select_same_conv"
  ON public.family_chat_participants FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "chat_msg_select_participant" ON public.family_chat_messages;
CREATE POLICY "chat_msg_select_participant"
  ON public.family_chat_messages FOR SELECT
  TO authenticated
  USING (public.family_chat_is_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "chat_msg_insert_participant_friend" ON public.family_chat_messages;
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

DROP POLICY IF EXISTS "chat_media_select_participant" ON storage.objects;
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

DROP POLICY IF EXISTS "chat_media_insert_own" ON storage.objects;
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
