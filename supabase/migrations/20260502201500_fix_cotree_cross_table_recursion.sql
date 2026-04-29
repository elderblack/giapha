-- Nhánh OR EXISTS(public.family_trees...) trong policy cotree gây đệ quy CHÉO với
-- policy SELECT trên family_trees (trees đọc roles → roles đọc trees → …).
-- Đọc chủ sở hữu cây qua SECURITY DEFINER, không kích hoạt RLS trên family_trees trong policy của roles.

CREATE OR REPLACE FUNCTION public.family_tree_is_owned_by_me(p_family_tree_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_trees ft
    WHERE ft.id = p_family_tree_id AND ft.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.family_tree_is_owned_by_me(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_tree_is_owned_by_me(UUID) TO authenticated;

DROP POLICY IF EXISTS "family_tree_roles_select_cotree" ON public.family_tree_roles;

CREATE POLICY "family_tree_roles_select_cotree"
  ON public.family_tree_roles FOR SELECT
  TO authenticated
  USING (
    family_tree_roles.family_tree_id IN (SELECT public.family_tree_ids_for_me())
    OR public.family_tree_is_owned_by_me(family_tree_roles.family_tree_id)
  );
