-- INSERT family_chat_messages: cho phép gửi khi là bạn bè HOẶC cùng dòng họ
-- (khớp logic family_chat_open_dm; trước đây RLS chỉ kiểm tra friendship).

CREATE OR REPLACE FUNCTION public.family_chat_may_message(p_user_a UUID, p_user_b UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_user_a IS NOT NULL
    AND p_user_b IS NOT NULL
    AND p_user_a <> p_user_b
    AND (
      EXISTS (
        SELECT 1 FROM public.family_friendships
        WHERE user_low = LEAST(p_user_a, p_user_b)
          AND user_high = GREATEST(p_user_a, p_user_b)
      )
      OR EXISTS (
        SELECT 1
        FROM public.family_tree_roles a
        INNER JOIN public.family_tree_roles b ON a.family_tree_id = b.family_tree_id
        WHERE a.user_id = p_user_a AND b.user_id = p_user_b
      )
      OR EXISTS (
        SELECT 1 FROM public.family_trees ft
        INNER JOIN public.family_tree_roles r ON r.family_tree_id = ft.id AND r.user_id = p_user_b
        WHERE ft.owner_id = p_user_a
      )
      OR EXISTS (
        SELECT 1 FROM public.family_trees ft
        INNER JOIN public.family_tree_roles r ON r.family_tree_id = ft.id AND r.user_id = p_user_a
        WHERE ft.owner_id = p_user_b
      )
    );
$$;

REVOKE ALL ON FUNCTION public.family_chat_may_message(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_chat_may_message(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.family_chat_may_message(UUID, UUID) IS
  'True iff hai user được phép DM: bạn bè hoặc cùng dòng họ / chủ-thành viên (khớp family_chat_open_dm).';

DROP POLICY IF EXISTS "chat_msg_insert_participant_friend" ON public.family_chat_messages;
CREATE POLICY "chat_msg_insert_participant_eligible"
  ON public.family_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.family_chat_is_participant(conversation_id, auth.uid())
    AND public.family_chat_may_message(
      auth.uid(),
      public.family_chat_dm_peer_id(conversation_id, auth.uid())
    )
  );
