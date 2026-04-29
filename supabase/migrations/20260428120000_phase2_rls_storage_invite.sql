-- GiaPhả Phase 2 — Auth & profile: RLS bổ sung, mã mời dòng họ, Storage ảnh hồ sơ

-- ---------------------------------------------------------------------------
-- Mã mời tham gia dòng họ
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_trees
  ADD COLUMN IF NOT EXISTS invite_code UUID DEFAULT gen_random_uuid();

UPDATE public.family_trees SET invite_code = gen_random_uuid() WHERE invite_code IS NULL;

ALTER TABLE public.family_trees
  ALTER COLUMN invite_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_trees_invite_code_uidx
  ON public.family_trees (invite_code);

-- ---------------------------------------------------------------------------
-- family_trees: tạo / cập nhật (chủ sở hữu)
-- ---------------------------------------------------------------------------
CREATE POLICY "family_trees_insert_as_owner"
  ON public.family_trees FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "family_trees_update_owner"
  ON public.family_trees FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- family_tree_roles: chủ thêm chính mình sau khi tạo dòng họ
-- ---------------------------------------------------------------------------
CREATE POLICY "family_tree_roles_insert_owner_self"
  ON public.family_tree_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Tham gia dòng họ bằng mã mời
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.join_family_tree(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_family_tree(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket ảnh hồ sơ
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "profile_media_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-media');

CREATE POLICY "profile_media_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_media_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "profile_media_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
