-- Phase 3 — Quyền biên tập viên (editor): chỉnh thành viên cây như chủ, trừ đổi quyền tài khoản (chỉ chủ).

-- ---------------------------------------------------------------------------
-- Chuẩn hoá role (đã dùng owner / member; thêm editor)
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_tree_roles
  DROP CONSTRAINT IF EXISTS family_tree_roles_role_chk;

ALTER TABLE public.family_tree_roles
  ADD CONSTRAINT family_tree_roles_role_chk
  CHECK (role IN ('owner', 'editor', 'member'));

-- ---------------------------------------------------------------------------
-- Xem profile người cùng dòng họ (để chủ hiển thị tên khi gán editor)
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select_if_shared_family_tree"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_tree_roles a
      INNER JOIN public.family_tree_roles b ON a.family_tree_id = b.family_tree_id
      WHERE a.user_id = auth.uid()
        AND b.user_id = public.profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      INNER JOIN public.family_tree_roles r ON r.family_tree_id = ft.id
      WHERE ft.owner_id = auth.uid()
        AND r.user_id = public.profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- Xem mọi role trong cùng cây (danh sách tài khoản + quyền)
-- ---------------------------------------------------------------------------
CREATE POLICY "family_tree_roles_select_cotree"
  ON public.family_tree_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_roles.family_tree_id
        AND ftr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_roles.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Chỉ chủ dòng họ đổi role editor/member của người khác (không sửa dòng của chính mình)
-- ---------------------------------------------------------------------------
CREATE POLICY "family_tree_roles_update_by_owner_others"
  ON public.family_tree_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_roles.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    AND family_tree_roles.user_id IS DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    role IN ('member', 'editor')
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_roles.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    AND family_tree_roles.user_id IS DISTINCT FROM auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Thành viên cây: INSERT/UPDATE/DELETE — chủ HOẶC editor
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "family_tree_members_insert_if_owner" ON public.family_tree_members;
CREATE POLICY "family_tree_members_insert_if_owner_or_editor"
  ON public.family_tree_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_members.family_tree_id
        AND ftr.user_id = auth.uid()
        AND ftr.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "family_tree_members_update_if_owner" ON public.family_tree_members;
CREATE POLICY "family_tree_members_update_if_owner_or_editor"
  ON public.family_tree_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_members.family_tree_id
        AND ftr.user_id = auth.uid()
        AND ftr.role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_members.family_tree_id
        AND ftr.user_id = auth.uid()
        AND ftr.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "family_tree_members_delete_if_owner" ON public.family_tree_members;
CREATE POLICY "family_tree_members_delete_if_owner_or_editor"
  ON public.family_tree_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_members.family_tree_id
        AND ftr.user_id = auth.uid()
        AND ftr.role IN ('owner', 'editor')
    )
  );

-- ---------------------------------------------------------------------------
-- unlink: chủ hoặc editor có thể gỡ liên kết người khác; vẫn gỡ được của chính mình
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_family_tree_member(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree UUID;
  v_owner UUID;
  v_linked UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT m.family_tree_id, m.linked_profile_id
  INTO v_tree, v_linked
  FROM public.family_tree_members m
  WHERE m.id = p_member_id;

  IF v_tree IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT ft.owner_id INTO v_owner FROM public.family_trees ft WHERE ft.id = v_tree;

  IF v_linked = auth.uid() THEN
    NULL;
  ELSIF v_owner = auth.uid() THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM public.family_tree_roles ftr
    WHERE ftr.family_tree_id = v_tree
      AND ftr.user_id = auth.uid()
      AND ftr.role = 'editor'
  ) THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  UPDATE public.family_tree_members
  SET linked_profile_id = NULL
  WHERE id = p_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_family_tree_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_family_tree_member(UUID) TO authenticated;
