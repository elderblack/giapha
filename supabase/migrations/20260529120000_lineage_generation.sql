-- Đời ghi trong phả (tùy chọn): phân tầng lão tổ / mốc không có cha mẹ mà vẫn muốn đúng thứ tự đời trên sơ đồ

ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS lineage_generation INTEGER;

ALTER TABLE public.family_tree_members DROP CONSTRAINT IF EXISTS family_tree_members_lineage_generation_chk;
ALTER TABLE public.family_tree_members
  ADD CONSTRAINT family_tree_members_lineage_generation_chk CHECK (
    lineage_generation IS NULL OR lineage_generation >= 0
  );

COMMENT ON COLUMN public.family_tree_members.lineage_generation IS
  'Đời trong phả (0=Lão tổ đời 1, 1=đời 2…). Khớp UI; đồng thời cộng với cạnh cha/mẹ để ra thế hệ hiệu dụng.';

CREATE OR REPLACE FUNCTION public.ft_generations_for_tree(p_tree UUID)
RETURNS TABLE(member_id UUID, gen INT)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  mm RECORD;
  gmap JSONB := '{}'::jsonb;
  k TEXT;
  v JSONB;
  cur INT;
  nxt INT;
  sg INT;
  t INT;
  changed BOOLEAN;
  guard INT := 0;
BEGIN
  FOR mm IN
    SELECT id, COALESCE(lineage_generation, 0) AS lg
    FROM public.family_tree_members
    WHERE family_tree_id = p_tree
  LOOP
    gmap := gmap || jsonb_build_object(mm.id::text, mm.lg);
  END LOOP;

  LOOP
    guard := guard + 1;
    EXIT WHEN guard > 500;
    changed := FALSE;

    FOR mm IN
      SELECT id, father_id, mother_id
      FROM public.family_tree_members
      WHERE family_tree_id = p_tree
    LOOP
      cur := COALESCE((gmap ->> mm.id::text)::int, 0);
      nxt := cur;
      IF mm.father_id IS NOT NULL THEN
        nxt := GREATEST(nxt, COALESCE((gmap ->> mm.father_id::text)::int, -1) + 1);
      END IF;
      IF mm.mother_id IS NOT NULL THEN
        nxt := GREATEST(nxt, COALESCE((gmap ->> mm.mother_id::text)::int, -1) + 1);
      END IF;
      IF nxt > cur THEN
        gmap := jsonb_set(gmap, ARRAY[mm.id::text], to_jsonb(nxt));
        changed := TRUE;
      END IF;
    END LOOP;

    FOR mm IN
      SELECT id, spouse_id
      FROM public.family_tree_members
      WHERE family_tree_id = p_tree AND spouse_id IS NOT NULL
    LOOP
      cur := COALESCE((gmap ->> mm.id::text)::int, 0);
      sg := COALESCE((gmap ->> mm.spouse_id::text)::int, 0);
      t := GREATEST(cur, sg);
      IF t > cur THEN
        gmap := jsonb_set(gmap, ARRAY[mm.id::text], to_jsonb(t));
        changed := TRUE;
      END IF;
      IF t > sg THEN
        gmap := jsonb_set(gmap, ARRAY[mm.spouse_id::text], to_jsonb(t));
        changed := TRUE;
      END IF;
    END LOOP;

    EXIT WHEN NOT changed;
  END LOOP;

  FOR k, v IN SELECT * FROM jsonb_each(gmap)
  LOOP
    member_id := k::uuid;
    gen := (v::text)::int;
    RETURN NEXT;
  END LOOP;
END;
$$;
