-- Thế hệ trên DB: đồng bộ vợ/chồng (cùng max) để RPC ft_same_generation khớp UI

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
  FOR mm IN SELECT id FROM public.family_tree_members WHERE family_tree_id = p_tree
  LOOP
    gmap := gmap || jsonb_build_object(mm.id::text, 0);
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
