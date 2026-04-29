-- Dữ liệu mẫu 3 thế hệ: tạo một dòng họ «Phả mẫu — Gia Phả» (nếu chưa có) gắn chủ sở hữu lấy từ một dòng họ hiện có.

DO $$
DECLARE
  demo_name CONSTANT text := 'Phả mẫu — Gia Phả';
  owner_uid uuid;
  tid uuid;
  m1 uuid;
  m2 uuid;
  m3 uuid;
  m4 uuid;
  m5 uuid;
BEGIN
  SELECT ft.owner_id
  INTO owner_uid
  FROM public.family_trees ft
  WHERE ft.owner_id IS NOT NULL
  ORDER BY ft.created_at ASC
  LIMIT 1;

  IF owner_uid IS NULL THEN
    RAISE NOTICE 'seed_demo_phả: không có family_trees với owner_id — bỏ qua';
    RETURN;
  END IF;

  SELECT ft.id INTO tid FROM public.family_trees ft WHERE ft.name = demo_name LIMIT 1;

  IF tid IS NOT NULL THEN
    RAISE NOTICE 'seed_demo_phả: cây demo đã tồn tại — bỏ qua';
    RETURN;
  END IF;

  INSERT INTO public.family_trees (name, clan_name, origin_place, description, owner_id)
  VALUES (
    demo_name,
    'Chi mẫu',
    'Hà Thành — Việt Nam',
    'Dữ liệu mẫu (ông bà → con → cháu). Có thể xóa cây này trong app nếu không cần.',
    owner_uid
  )
  RETURNING id INTO tid;

  INSERT INTO public.family_tree_roles (family_tree_id, user_id, role)
  VALUES (tid, owner_uid, 'owner')
  ON CONFLICT (family_tree_id, user_id) DO NOTHING;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, death_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Văn Tổ',
    'male',
    '1925-03-15',
    '2010-07-20',
    'Thế hệ gốc',
    NULL,
    NULL
  )
  RETURNING id INTO m1;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, death_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Trần Thị Hiền',
    'female',
    '1928-11-02',
    '2015-01-10',
    'Phối ngẫu ông Tổ',
    NULL,
    NULL
  )
  RETURNING id INTO m2;

  UPDATE public.family_tree_members SET spouse_id = m2 WHERE id = m1;
  UPDATE public.family_tree_members SET spouse_id = m1 WHERE id = m2;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Văn Trung',
    'male',
    '1952-06-01',
    'Con trai ông bà Tổ',
    m1,
    m2
  )
  RETURNING id INTO m3;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Lê Thị Đoan',
    'female',
    '1955-09-18',
    'Con dâu / vợ anh Trung',
    NULL,
    NULL
  )
  RETURNING id INTO m4;

  UPDATE public.family_tree_members SET spouse_id = m4 WHERE id = m3;
  UPDATE public.family_tree_members SET spouse_id = m3 WHERE id = m4;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Văn Lập',
    'male',
    '1982-04-22',
    'Cháu nội — con anh Trung & chị Đoan',
    m3,
    m4
  )
  RETURNING id INTO m5;

  RAISE NOTICE 'seed_demo_phả: đã tạo cây % với 5 thành viên', tid;
END $$;
