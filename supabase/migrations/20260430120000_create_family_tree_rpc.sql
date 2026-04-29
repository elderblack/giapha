-- Atomic tạo dòng họ + gán role chủ (tránh lỗi khi client gọi 2 request riêng hoặc RLS/RETURNING)

CREATE OR REPLACE FUNCTION public.create_family_tree(
  p_name TEXT,
  p_clan_name TEXT DEFAULT NULL,
  p_origin_place TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree_id UUID;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  v_name := trim(p_name);
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'name_too_short';
  END IF;

  INSERT INTO public.family_trees (
    name,
    clan_name,
    origin_place,
    description,
    owner_id
  )
  VALUES (
    v_name,
    NULLIF(trim(COALESCE(p_clan_name, '')), ''),
    NULLIF(trim(COALESCE(p_origin_place, '')), ''),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_tree_id;

  INSERT INTO public.family_tree_roles (family_tree_id, user_id, role)
  VALUES (v_tree_id, auth.uid(), 'owner')
  ON CONFLICT (family_tree_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  RETURN v_tree_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family_tree(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_tree(TEXT, TEXT, TEXT, TEXT) TO authenticated;
