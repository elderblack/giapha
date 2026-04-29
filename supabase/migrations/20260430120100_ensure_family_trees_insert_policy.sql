-- Một số project có thể thiếu policy INSERT sau khi chỉnh tay / migrate từng phần.
-- Policy này khớp migration phase 2; idempotent theo tên.

DROP POLICY IF EXISTS "family_trees_insert_as_owner" ON public.family_trees;
CREATE POLICY "family_trees_insert_as_owner"
  ON public.family_trees FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "family_trees_update_owner" ON public.family_trees;
CREATE POLICY "family_trees_update_owner"
  ON public.family_trees FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
