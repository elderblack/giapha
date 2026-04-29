-- Tránh đệ quy RLS khi đọc family_tree_roles: policy "cotree" không được dùng
-- subquery lại chính bảng (Postgres báo infinite recursion trong policy).

CREATE OR REPLACE FUNCTION public.family_tree_ids_for_me()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_tree_id FROM public.family_tree_roles WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.family_tree_ids_for_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_tree_ids_for_me() TO authenticated;

DROP POLICY IF EXISTS "family_tree_roles_select_cotree" ON public.family_tree_roles;

CREATE POLICY "family_tree_roles_select_cotree"
  ON public.family_tree_roles FOR SELECT
  TO authenticated
  USING (
    family_tree_roles.family_tree_id IN (SELECT public.family_tree_ids_for_me())
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_roles.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );
