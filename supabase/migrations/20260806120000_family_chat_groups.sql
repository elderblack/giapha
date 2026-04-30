-- Phase 5 — Nhóm chat: tạo tay + nhóm tự động theo nhánh (subtree gốc từ một thành viên cây).

-- 1) conversations: kind 'group', tiêu đề, cây/nhánh liên kết
ALTER TABLE public.family_chat_conversations
  DROP CONSTRAINT IF EXISTS family_chat_conversations_kind_check;

ALTER TABLE public.family_chat_conversations
  ADD CONSTRAINT family_chat_conversations_kind_check CHECK (kind IN ('dm', 'group'));

ALTER TABLE public.family_chat_conversations
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS family_tree_id UUID REFERENCES public.family_trees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_root_member_id UUID REFERENCES public.family_tree_members (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_chat_conv_branch_unique
  ON public.family_chat_conversations (family_tree_id, branch_root_member_id)
  WHERE kind = 'group' AND branch_root_member_id IS NOT NULL;

COMMENT ON COLUMN public.family_chat_conversations.title IS 'Tên hiển thị (nhóm tay hoặc nhánh tự đặt). DM để NULL.';
COMMENT ON COLUMN public.family_chat_conversations.branch_root_member_id IS 'Nếu set: nhóm tự động theo subtree (hậu duệ) từ thành viên này.';

-- 2) Tin nhắn: DM giữ may_message + peer; nhóm chỉ cần là participant
DROP POLICY IF EXISTS "chat_msg_insert_participant_eligible" ON public.family_chat_messages;

CREATE POLICY "chat_msg_insert_participant_eligible"
  ON public.family_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.family_chat_is_participant(conversation_id, auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.family_chat_conversations c
        WHERE c.id = conversation_id AND c.kind = 'group'
      )
      OR public.family_chat_may_message(
        auth.uid(),
        public.family_chat_dm_peer_id(conversation_id, auth.uid())
      )
    )
  );

-- 3) RPC: tạo nhóm tay — mọi cặp creator↔thành viên phải may_message
CREATE OR REPLACE FUNCTION public.family_chat_create_group(
  p_title TEXT,
  p_member_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_conv UUID;
  v_title TEXT;
  v_members UUID[];
  m UUID;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::uuid[])
  INTO v_members
  FROM (SELECT DISTINCT unnest(coalesce(p_member_ids, ARRAY[]::uuid[])) AS x) u;

  IF array_length(v_members, 1) IS NULL OR cardinality(v_members) < 2 THEN
    RAISE EXCEPTION 'group_need_at_least_two_members';
  END IF;

  IF NOT (v_me = ANY (v_members)) THEN
    RAISE EXCEPTION 'group_creator_must_be_member';
  END IF;

  FOREACH m IN ARRAY v_members
  LOOP
    IF m = v_me THEN
      CONTINUE;
    END IF;
    IF NOT public.family_chat_may_message(v_me, m) THEN
      RAISE EXCEPTION 'group_member_not_eligible';
    END IF;
  END LOOP;

  v_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Nhóm');

  INSERT INTO public.family_chat_conversations (kind, title, created_by)
  VALUES ('group', v_title, v_me)
  RETURNING id INTO v_conv;

  FOREACH m IN ARRAY v_members
  LOOP
    INSERT INTO public.family_chat_participants (conversation_id, user_id)
    VALUES (v_conv, m);
  END LOOP;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.family_chat_create_group(TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_chat_create_group(TEXT, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.family_chat_create_group(TEXT, UUID[]) IS
  'Tạo nhóm chat: danh sách thành viên phải gồm auth.uid(); mỗi cặp creator↔member phải được phép DM (bạn bè / cùng dòng họ).';

-- 4) RPC: nhóm nhánh — mọi người có linked_profile trong subtree (gốc = thành viên cây)
CREATE OR REPLACE FUNCTION public.family_chat_get_or_create_branch_group(
  p_family_tree_id UUID,
  p_branch_root_member_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_conv UUID;
  v_title TEXT;
  v_members UUID[];
  m UUID;
  v_root_name TEXT;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_tree_roles r
    WHERE r.family_tree_id = p_family_tree_id AND r.user_id = v_me
  ) AND NOT EXISTS (
    SELECT 1 FROM public.family_trees t
    WHERE t.id = p_family_tree_id AND t.owner_id = v_me
  ) THEN
    RAISE EXCEPTION 'no_tree_access';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_tree_members tm
    WHERE tm.id = p_branch_root_member_id AND tm.family_tree_id = p_family_tree_id
  ) THEN
    RAISE EXCEPTION 'invalid_branch_root_member';
  END IF;

  SELECT c.id INTO v_conv
  FROM public.family_chat_conversations c
  WHERE c.kind = 'group'
    AND c.family_tree_id = p_family_tree_id
    AND c.branch_root_member_id = p_branch_root_member_id
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    RETURN v_conv;
  END IF;

  WITH RECURSIVE subtree AS (
    SELECT id
    FROM public.family_tree_members
    WHERE id = p_branch_root_member_id AND family_tree_id = p_family_tree_id
    UNION
    SELECT m.id
    FROM public.family_tree_members m
    INNER JOIN subtree st ON m.father_id = st.id OR m.mother_id = st.id
    WHERE m.family_tree_id = p_family_tree_id
  ),
  linked AS (
    SELECT DISTINCT t.linked_profile_id AS uid
    FROM public.family_tree_members t
    INNER JOIN subtree s ON t.id = s.id
    WHERE t.linked_profile_id IS NOT NULL
  )
  SELECT coalesce(
    (SELECT array_agg(l.uid ORDER BY l.uid) FROM linked l),
    ARRAY[]::uuid[]
  )
  INTO v_members;

  IF v_members IS NULL OR cardinality(v_members) < 2 THEN
    RAISE EXCEPTION 'branch_group_too_few';
  END IF;

  IF NOT (v_me = ANY (v_members)) THEN
    RAISE EXCEPTION 'branch_group_not_in_subtree';
  END IF;

  SELECT trim(tm.full_name) INTO v_root_name
  FROM public.family_tree_members tm
  WHERE tm.id = p_branch_root_member_id AND tm.family_tree_id = p_family_tree_id;

  v_title := 'Nhánh: ' || coalesce(nullif(v_root_name, ''), '—');

  INSERT INTO public.family_chat_conversations (
    kind,
    title,
    family_tree_id,
    branch_root_member_id,
    created_by
  )
  VALUES (
    'group',
    v_title,
    p_family_tree_id,
    p_branch_root_member_id,
    v_me
  )
  RETURNING id INTO v_conv;

  FOREACH m IN ARRAY v_members
  LOOP
    INSERT INTO public.family_chat_participants (conversation_id, user_id)
    VALUES (v_conv, m);
  END LOOP;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.family_chat_get_or_create_branch_group(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_chat_get_or_create_branch_group(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.family_chat_get_or_create_branch_group(UUID, UUID) IS
  'Mở/tạo nhóm chat gồm mọi linked_profile trong subtree hậu duệ từ một thành viên; cần ≥2 tài khoản và user hiện tại thuộc subgroup.';
