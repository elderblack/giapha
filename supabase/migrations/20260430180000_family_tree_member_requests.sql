-- Đề xuất thêm thành viên (thành viên thường) — chờ chủ / biên tập viên duyệt

-- ---------------------------------------------------------------------------
-- Helpers: thế hệ & nhánh hậu duệ (theo cạnh cha/mẹ → con)
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.ft_same_generation(p_tree UUID, p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT g1.gen FROM public.ft_generations_for_tree(p_tree) g1 WHERE g1.member_id = p_a LIMIT 1
  ), -1) = COALESCE((
    SELECT g2.gen FROM public.ft_generations_for_tree(p_tree) g2 WHERE g2.member_id = p_b LIMIT 1
  ), -2);
$$;

-- p_node thuộc cận dưới của p_root (gồm cả chính p_root): p_root = p_node hoặc p_node là hậu duệ
CREATE OR REPLACE FUNCTION public.ft_in_subtree(p_tree UUID, p_root UUID, p_node UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE down AS (
    SELECT id FROM public.family_tree_members
    WHERE family_tree_id = p_tree AND id = p_root
    UNION
    SELECT m.id FROM public.family_tree_members m
    INNER JOIN down d ON m.family_tree_id = p_tree AND (m.father_id = d.id OR m.mother_id = d.id)
  )
  SELECT EXISTS (SELECT 1 FROM down WHERE id = p_node);
$$;

-- ---------------------------------------------------------------------------
-- Bảng đề xuất
-- ---------------------------------------------------------------------------
CREATE TABLE public.family_tree_member_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id UUID NOT NULL REFERENCES public.family_trees (id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_kind TEXT NOT NULL CHECK (request_kind IN ('spouse', 'child')),
  spouse_of_member_id UUID REFERENCES public.family_tree_members (id) ON DELETE CASCADE,
  child_parent_member_id UUID REFERENCES public.family_tree_members (id) ON DELETE CASCADE,
  child_parent_as TEXT CHECK (child_parent_as IS NULL OR child_parent_as IN ('father', 'mother')),
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
  birth_date DATE,
  death_date DATE,
  notes TEXT,
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_tree_member_requests_kind_chk CHECK (
    (request_kind = 'spouse' AND spouse_of_member_id IS NOT NULL AND child_parent_member_id IS NULL AND child_parent_as IS NULL)
    OR (request_kind = 'child' AND child_parent_member_id IS NOT NULL AND child_parent_as IS NOT NULL AND spouse_of_member_id IS NULL)
  )
);

CREATE INDEX idx_ft_member_req_tree_status ON public.family_tree_member_requests (family_tree_id, status);
CREATE INDEX idx_ft_member_req_requested_by ON public.family_tree_member_requests (requested_by);

ALTER TABLE public.family_tree_member_requests ENABLE ROW LEVEL SECURITY;

-- Chủ / editor xem mọi đề xuất của cây; người gửi xem của mình
CREATE POLICY "ft_member_requests_select"
  ON public.family_tree_member_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_tree_member_requests.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_tree_member_requests.family_tree_id
        AND ftr.user_id = auth.uid()
        AND ftr.role = 'editor'
    )
  );

-- Chèn / sửa chỉ qua RPC (không grant INSERT/UPDATE client)

-- ---------------------------------------------------------------------------
-- Gửi đề xuất — chỉ role member (không chủ / không editor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_family_tree_member_request(
  p_family_tree_id UUID,
  p_kind TEXT,
  p_spouse_of_member_id UUID,
  p_child_parent_member_id UUID,
  p_child_parent_as TEXT,
  p_full_name TEXT,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_death_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req UUID;
  v_self_member UUID;
  v_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_tree_roles r
    WHERE r.family_tree_id = p_family_tree_id
      AND r.user_id = auth.uid()
      AND r.role = 'member'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'only_member_role');
  END IF;

  SELECT m.id INTO v_self_member
  FROM public.family_tree_members m
  WHERE m.family_tree_id = p_family_tree_id
    AND m.linked_profile_id = auth.uid()
  LIMIT 1;

  IF v_self_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'must_claim_node');
  END IF;

  v_name := trim(p_full_name);
  IF char_length(v_name) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_too_short');
  END IF;

  IF p_kind = 'spouse' THEN
    IF p_spouse_of_member_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_spouse');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.family_tree_members m
      WHERE m.id = p_spouse_of_member_id AND m.family_tree_id = p_family_tree_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_spouse');
    END IF;
    IF NOT public.ft_same_generation(p_family_tree_id, v_self_member, p_spouse_of_member_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'spouse_not_same_generation');
    END IF;

    INSERT INTO public.family_tree_member_requests (
      family_tree_id, requested_by, status, request_kind,
      spouse_of_member_id, full_name, gender, birth_date, death_date, notes
    ) VALUES (
      p_family_tree_id, auth.uid(), 'pending', 'spouse',
      p_spouse_of_member_id, v_name, NULLIF(trim(COALESCE(p_gender, '')), ''),
      p_birth_date, p_death_date, NULLIF(trim(COALESCE(p_notes, '')), '')
    )
    RETURNING id INTO v_req;

  ELSIF p_kind = 'child' THEN
    IF p_child_parent_member_id IS NULL OR p_child_parent_as IS NULL
       OR p_child_parent_as NOT IN ('father', 'mother') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_child_parent');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.family_tree_members m
      WHERE m.id = p_child_parent_member_id AND m.family_tree_id = p_family_tree_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_child_parent');
    END IF;
    IF NOT public.ft_in_subtree(p_family_tree_id, v_self_member, p_child_parent_member_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'parent_not_in_your_branch');
    END IF;

    INSERT INTO public.family_tree_member_requests (
      family_tree_id, requested_by, status, request_kind,
      child_parent_member_id, child_parent_as,
      full_name, gender, birth_date, death_date, notes
    ) VALUES (
      p_family_tree_id, auth.uid(), 'pending', 'child',
      p_child_parent_member_id, p_child_parent_as,
      v_name, NULLIF(trim(COALESCE(p_gender, '')), ''),
      p_birth_date, p_death_date, NULLIF(trim(COALESCE(p_notes, '')), '')
    )
    RETURNING id INTO v_req;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_kind');
  END IF;

  RETURN jsonb_build_object('ok', true, 'request_id', v_req);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_family_tree_member_request(UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_family_tree_member_request(UUID, TEXT, UUID, UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Duyệt / từ chối — chủ hoặc editor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_family_tree_member_request(
  p_request_id UUID,
  p_approve BOOLEAN,
  p_reject_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_new UUID;
  v_partner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO r
  FROM public.family_tree_member_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_trees ft
    WHERE ft.id = r.family_tree_id AND ft.owner_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.family_tree_roles ftr
    WHERE ftr.family_tree_id = r.family_tree_id
      AND ftr.user_id = auth.uid()
      AND ftr.role = 'editor'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF NOT p_approve THEN
    UPDATE public.family_tree_member_requests
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        reject_reason = NULLIF(trim(COALESCE(p_reject_reason, '')), '')
    WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF r.request_kind = 'spouse' THEN
    INSERT INTO public.family_tree_members (
      family_tree_id, full_name, gender, birth_date, death_date, notes
    ) VALUES (
      r.family_tree_id, r.full_name, r.gender, r.birth_date, r.death_date, r.notes
    )
    RETURNING id INTO v_new;

    SELECT spouse_id INTO v_partner FROM public.family_tree_members WHERE id = r.spouse_of_member_id;
    IF v_partner IS NOT NULL THEN
      UPDATE public.family_tree_members SET spouse_id = NULL WHERE id = v_partner;
    END IF;
    UPDATE public.family_tree_members SET spouse_id = NULL WHERE spouse_id = r.spouse_of_member_id;
    UPDATE public.family_tree_members SET spouse_id = NULL WHERE id = r.spouse_of_member_id;

    UPDATE public.family_tree_members SET spouse_id = r.spouse_of_member_id WHERE id = v_new;
    UPDATE public.family_tree_members SET spouse_id = v_new WHERE id = r.spouse_of_member_id;

  ELSIF r.request_kind = 'child' THEN
    IF r.child_parent_as = 'father' THEN
      INSERT INTO public.family_tree_members (
        family_tree_id, full_name, gender, birth_date, death_date, notes, father_id
      ) VALUES (
        r.family_tree_id, r.full_name, r.gender, r.birth_date, r.death_date, r.notes, r.child_parent_member_id
      )
      RETURNING id INTO v_new;
    ELSE
      INSERT INTO public.family_tree_members (
        family_tree_id, full_name, gender, birth_date, death_date, notes, mother_id
      ) VALUES (
        r.family_tree_id, r.full_name, r.gender, r.birth_date, r.death_date, r.notes, r.child_parent_member_id
      )
      RETURNING id INTO v_new;
    END IF;
  END IF;

  UPDATE public.family_tree_member_requests
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'member_id', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.review_family_tree_member_request(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_family_tree_member_request(UUID, BOOLEAN, TEXT) TO authenticated;
