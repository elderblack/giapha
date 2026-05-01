-- Storage RLS: policy cũ dùng EXISTS (SELECT … FROM family_trees) — subquery vẫn áp dụng RLS
-- trên family_trees nên có thể không “thấy” hàng cây → INSERT storage.objects bị lỗi
-- "new row violates row-level security policy". Dùng SECURITY DEFINER + id::uuid rõ ràng.

CREATE OR REPLACE FUNCTION public.family_tree_brand_owner_allows_storage_object(p_bucket_id text, p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_tree uuid;
  v_seg text;
  v_clean text;
BEGIN
  IF p_bucket_id IS DISTINCT FROM 'family-tree-brand' OR p_object_name IS NULL THEN
    RETURN false;
  END IF;

  v_clean := trim(both '/' from p_object_name);
  IF length(v_clean) = 0 THEN
    RETURN false;
  END IF;

  v_seg := (string_to_array(v_clean, '/'))[1];
  IF v_seg IS NULL OR trim(v_seg) = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_tree := trim(v_seg)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.family_trees ft
    WHERE ft.id = v_tree
      AND ft.owner_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.family_tree_brand_owner_allows_storage_object(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_tree_brand_owner_allows_storage_object(text, text) TO authenticated;

DROP POLICY IF EXISTS "family_tree_brand_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "family_tree_brand_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "family_tree_brand_delete_owner" ON storage.objects;

CREATE POLICY "family_tree_brand_insert_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (public.family_tree_brand_owner_allows_storage_object(bucket_id, name));

CREATE POLICY "family_tree_brand_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (public.family_tree_brand_owner_allows_storage_object(bucket_id, name))
  WITH CHECK (public.family_tree_brand_owner_allows_storage_object(bucket_id, name));

CREATE POLICY "family_tree_brand_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (public.family_tree_brand_owner_allows_storage_object(bucket_id, name));
