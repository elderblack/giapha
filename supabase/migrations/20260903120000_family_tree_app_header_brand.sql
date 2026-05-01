-- Logo + tên hiển thị trên thanh app (chỉ chủ dòng owner_id cập nhật; mọi thành viên đọc để render header).

ALTER TABLE public.family_trees
  ADD COLUMN IF NOT EXISTS app_header_display_name TEXT,
  ADD COLUMN IF NOT EXISTS app_header_logo_path TEXT;

COMMENT ON COLUMN public.family_trees.app_header_display_name IS 'Tên thay thế "GiaPhả" trên header app; null/blank = mặc định.';
COMMENT ON COLUMN public.family_trees.app_header_logo_path IS 'Đường dẫn object trong bucket family-tree-brand, vd. {tree_id}/header-logo.png';

ALTER TABLE public.family_trees
  DROP CONSTRAINT IF EXISTS family_trees_app_header_display_name_len;
ALTER TABLE public.family_trees
  ADD CONSTRAINT family_trees_app_header_display_name_len CHECK (
    app_header_display_name IS NULL
    OR (char_length(trim(app_header_display_name)) BETWEEN 1 AND 32)
  );

-- ---------------------------------------------------------------------------
-- Storage: ảnh logo header (public đọc; ghi chỉ chủ dòng khớp folder = tree id)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-tree-brand',
  'family-tree-brand',
  true,
  1048576,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "family_tree_brand_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'family-tree-brand');

CREATE POLICY "family_tree_brand_insert_owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'family-tree-brand'
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id::text = (string_to_array(name, '/'))[1]
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_tree_brand_update_owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'family-tree-brand'
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id::text = (string_to_array(name, '/'))[1]
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_tree_brand_delete_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'family-tree-brand'
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id::text = (string_to_array(name, '/'))[1]
        AND ft.owner_id = auth.uid()
    )
  );
