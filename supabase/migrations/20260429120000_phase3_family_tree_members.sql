-- GiaPhả Phase 3 — Thành viên dòng họ (quan hệ cha / mẹ trong cùng cây)

CREATE TABLE public.family_tree_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id UUID NOT NULL REFERENCES public.family_trees (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  death_date DATE,
  notes TEXT,
  father_id UUID REFERENCES public.family_tree_members (id) ON DELETE SET NULL,
  mother_id UUID REFERENCES public.family_tree_members (id) ON DELETE SET NULL,
  linked_profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_tree_members_gender_chk CHECK (
    gender IS NULL OR gender IN ('male', 'female', 'other')
  ),
  CONSTRAINT family_tree_members_not_self_father CHECK (father_id IS NULL OR father_id <> id),
  CONSTRAINT family_tree_members_not_self_mother CHECK (mother_id IS NULL OR mother_id <> id)
);

CREATE INDEX idx_family_tree_members_tree ON public.family_tree_members (family_tree_id);
CREATE INDEX idx_family_tree_members_father ON public.family_tree_members (father_id) WHERE father_id IS NOT NULL;
CREATE INDEX idx_family_tree_members_mother ON public.family_tree_members (mother_id) WHERE mother_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.family_tree_members_parents_same_tree()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.father_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_tree_members m
      WHERE m.id = NEW.father_id AND m.family_tree_id = NEW.family_tree_id
    ) THEN
      RAISE EXCEPTION 'father_id must reference a member in the same family tree';
    END IF;
  END IF;
  IF NEW.mother_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_tree_members m
      WHERE m.id = NEW.mother_id AND m.family_tree_id = NEW.family_tree_id
    ) THEN
      RAISE EXCEPTION 'mother_id must reference a member in the same family tree';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER family_tree_members_parents_same_tree_trg
  BEFORE INSERT OR UPDATE ON public.family_tree_members
  FOR EACH ROW
  EXECUTE FUNCTION public.family_tree_members_parents_same_tree();

CREATE TRIGGER family_tree_members_updated_at
  BEFORE UPDATE ON public.family_tree_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.family_tree_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_tree_members_select_if_tree_access"
  ON public.family_tree_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_members.family_tree_id
        AND ftr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_tree_members_insert_if_owner"
  ON public.family_tree_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_tree_members_update_if_owner"
  ON public.family_tree_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_tree_members_delete_if_owner"
  ON public.family_tree_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_members.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );
