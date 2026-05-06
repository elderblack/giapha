-- Mở rộng nhánh mẫu xuống thế hệ sinh thế kỷ 21 (con / cháu của Nguyễn Văn Lập).
-- Idempotent: bỏ qua nếu đã có vợ/chồng mẫu TK21.

DO $$
DECLARE
  tid CONSTANT uuid := '7e6d5265-62f4-41b2-af10-7ebe057494d0'::uuid;
  v_lap uuid;
  v_ha uuid;
  v_an uuid;
  v_huy uuid;
  v_chau uuid;
  v_duong uuid;
  v_long uuid;
  v_ngan uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.family_trees WHERE id = tid) THEN
    RAISE NOTICE 'extend_21c: không có cây % — bỏ qua', tid;
    RETURN;
  END IF;

  SELECT m.id
  INTO v_lap
  FROM public.family_tree_members m
  WHERE m.family_tree_id = tid
    AND m.full_name = 'Nguyễn Văn Lập'
    AND (m.notes ILIKE '%dữ liệu mẫu%' OR m.notes ILIKE '%Cháu nội%')
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_lap IS NULL THEN
    RAISE NOTICE 'extend_21c: không tìm thấy Nguyễn Văn Lập trên cây % — bỏ qua', tid;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_tree_members
    WHERE family_tree_id = tid
      AND notes = 'Phối ngẫu Lập — mẫu TK21'
    LIMIT 1
  ) THEN
    RAISE NOTICE 'extend_21c: nhánh TK21 đã có — bỏ qua (cây %)', tid;
    RETURN;
  END IF;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Phạm Thu Hà',
    'female',
    '1984-09-03',
    'Phối ngẫu Lập — mẫu TK21',
    NULL,
    NULL
  )
  RETURNING id INTO v_ha;

  UPDATE public.family_tree_members SET spouse_id = v_ha WHERE id = v_lap;
  UPDATE public.family_tree_members SET spouse_id = v_lap WHERE id = v_ha;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Minh An',
    'male',
    '2005-04-12',
    'Con Lập — thế kỷ 21 (mẫu)',
    v_lap,
    v_ha
  )
  RETURNING id INTO v_an;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Thuỳ Dương',
    'female',
    '2008-11-20',
    'Con Lập — thế kỷ 21 (mẫu)',
    v_lap,
    v_ha
  )
  RETURNING id INTO v_duong;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Bảo Long',
    'male',
    '2015-02-28',
    'Con Lập — thế kỷ 21 (mẫu)',
    v_lap,
    v_ha
  )
  RETURNING id INTO v_long;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Lưu Gia Huy',
    'male',
    '2004-01-18',
    'Phối ngẫu Minh An — mẫu TK21',
    NULL,
    NULL
  )
  RETURNING id INTO v_huy;

  UPDATE public.family_tree_members SET spouse_id = v_huy WHERE id = v_an;
  UPDATE public.family_tree_members SET spouse_id = v_an WHERE id = v_huy;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Bảo Châu',
    'female',
    '2020-07-08',
    'Cháu Minh An — thế kỷ 21 (mẫu)',
    v_an,
    v_huy
  )
  RETURNING id INTO v_chau;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Kim Ngân',
    'female',
    '2023-01-15',
    'Cháu Minh An — thế kỷ 21 (mẫu)',
    v_an,
    v_huy
  )
  RETURNING id INTO v_ngan;

  RAISE NOTICE 'extend_21c: đã thêm 8 thành viên (TK21) cho cây %', tid;
END $$;
