-- Mỗi tài khoản chỉ thuộc đúng một dòng họ (tối đa một dòng trong family_tree_roles).

-- 1) Gỡ trùng nếu đã có user xuất hiện ở nhiều cây (giữ một dòng: ưu tiên owner)
WITH ranked AS (
  SELECT ctid,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
        family_tree_id
    ) AS rn
  FROM public.family_tree_roles
)
DELETE FROM public.family_tree_roles f
USING ranked r
WHERE f.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS family_tree_roles_user_id_uidx
  ON public.family_tree_roles (user_id);

-- 2) Không cho INSERT family_trees nếu owner đã có role ở bất kỳ cây nào (chặn legacy client tạo cây “mồ côi”)
CREATE OR REPLACE FUNCTION public.family_trees_block_if_user_has_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.family_tree_roles WHERE user_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'already_in_family_tree'
      USING HINT = 'Mỗi tài khoản chỉ thuộc một dòng họ.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_trees_one_role_per_user_trg ON public.family_trees;
CREATE TRIGGER family_trees_one_role_per_user_trg
  BEFORE INSERT ON public.family_trees
  FOR EACH ROW
  EXECUTE FUNCTION public.family_trees_block_if_user_has_role();

-- 3) RPC tạo cây: kiểm tra rõ ràng
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

  IF EXISTS (SELECT 1 FROM public.family_tree_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_in_family_tree';
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

-- 4) Tham gia: không cho nếu đã thuộc cây khác
CREATE OR REPLACE FUNCTION public.join_family_tree(p_invite UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tree UUID;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, name INTO v_tree, v_name
  FROM public.family_trees
  WHERE invite_code = p_invite;

  IF v_tree IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_tree_roles
    WHERE user_id = auth.uid()
      AND family_tree_id <> v_tree
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_in_another_tree');
  END IF;

  INSERT INTO public.family_tree_roles (family_tree_id, user_id, role)
  VALUES (v_tree, auth.uid(), 'member')
  ON CONFLICT (family_tree_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'family_tree_id', v_tree,
    'name', v_name
  );
END;
$$;
