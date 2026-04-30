-- Cho phép mở DM khi là bạn bè HOẶC cùng tham gia ít nhất một dòng họ (roles hoặc chủ cây).

CREATE OR REPLACE FUNCTION public.family_chat_open_dm(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_conv_id UUID;
  v_friends BOOLEAN;
  v_shares_tree BOOLEAN;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF other_user_id IS NULL OR other_user_id = v_me THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;

  v_friends := EXISTS (
    SELECT 1 FROM public.family_friendships
    WHERE user_low = LEAST(v_me, other_user_id)
      AND user_high = GREATEST(v_me, other_user_id)
  );

  v_shares_tree := EXISTS (
    SELECT 1
    FROM public.family_tree_roles a
    INNER JOIN public.family_tree_roles b ON a.family_tree_id = b.family_tree_id
    WHERE a.user_id = v_me AND b.user_id = other_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.family_trees ft
    INNER JOIN public.family_tree_roles r ON r.family_tree_id = ft.id AND r.user_id = other_user_id
    WHERE ft.owner_id = v_me
  )
  OR EXISTS (
    SELECT 1 FROM public.family_trees ft
    INNER JOIN public.family_tree_roles r ON r.family_tree_id = ft.id AND r.user_id = v_me
    WHERE ft.owner_id = other_user_id
  );

  IF NOT v_friends AND NOT v_shares_tree THEN
    RAISE EXCEPTION 'not_eligible_for_dm';
  END IF;

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

  INSERT INTO public.family_chat_conversations (kind)
  VALUES ('dm')
  RETURNING id INTO v_conv_id;

  INSERT INTO public.family_chat_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_me), (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$$;

COMMENT ON FUNCTION public.family_chat_open_dm(UUID) IS
  'Mở hoặc tạo DM: cho phép nếu là bạn bè (family_friendships) hoặc cùng dòng họ (family_tree_roles / chủ cây).';
