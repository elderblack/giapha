-- Vợ / chồng: liên kết trong cùng cây (một chiều đủ — UI có thể suy ngược)

ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS spouse_id UUID REFERENCES public.family_tree_members (id) ON DELETE SET NULL;

ALTER TABLE public.family_tree_members
  DROP CONSTRAINT IF EXISTS family_tree_members_not_self_spouse;

ALTER TABLE public.family_tree_members
  ADD CONSTRAINT family_tree_members_not_self_spouse
    CHECK (spouse_id IS NULL OR spouse_id <> id);

CREATE OR REPLACE FUNCTION public.family_tree_members_spouse_same_tree()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.spouse_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_tree_members m
      WHERE m.id = NEW.spouse_id AND m.family_tree_id = NEW.family_tree_id
    ) THEN
      RAISE EXCEPTION 'spouse_id must reference a member in the same family tree';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_tree_members_spouse_same_tree_trg ON public.family_tree_members;

CREATE TRIGGER family_tree_members_spouse_same_tree_trg
  BEFORE INSERT OR UPDATE OF spouse_id, family_tree_id ON public.family_tree_members
  FOR EACH ROW
  EXECUTE FUNCTION public.family_tree_members_spouse_same_tree();
