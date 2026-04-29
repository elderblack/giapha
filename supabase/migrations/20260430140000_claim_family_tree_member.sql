-- Phase 3 — Liên kết node phả hệ với tài khoản (claim / huỷ)

CREATE OR REPLACE FUNCTION public.claim_family_tree_member(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree UUID;
  v_linked UUID;
  v_owner UUID;
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

  IF v_owner IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.family_tree_roles ftr
       WHERE ftr.family_tree_id = v_tree AND ftr.user_id = auth.uid()
     ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_linked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_tree_members m2
    WHERE m2.family_tree_id = v_tree AND m2.linked_profile_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed_other');
  END IF;

  UPDATE public.family_tree_members
  SET linked_profile_id = auth.uid()
  WHERE id = p_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_family_tree_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_family_tree_member(UUID) TO authenticated;

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

  IF auth.uid() IS DISTINCT FROM v_owner AND auth.uid() IS DISTINCT FROM v_linked THEN
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
