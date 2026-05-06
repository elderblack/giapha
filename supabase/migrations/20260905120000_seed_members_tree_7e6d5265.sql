-- Dữ liệu mẫu cho một dòng họ cố định (UUID do môi trường dev tạo).
-- Chạy an toàn: chỉ khi `family_trees` tồn tại và chưa có `family_tree_members`.

DO $$
DECLARE
  tid CONSTANT uuid := '7e6d5265-62f4-41b2-af10-7ebe057494d0'::uuid;
  owner_uid uuid;
  m1 uuid;
  m2 uuid;
  m3 uuid;
  m4 uuid;
  m5 uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.family_trees WHERE id = tid) THEN
    RAISE NOTICE 'seed_tree_7e6d5265: không có family_trees id % — bỏ qua', tid;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_tree_members WHERE family_tree_id = tid LIMIT 1) THEN
    RAISE NOTICE 'seed_tree_7e6d5265: cây % đã có thành viên — bỏ qua', tid;
    RETURN;
  END IF;

  SELECT ft.owner_id INTO owner_uid FROM public.family_trees ft WHERE ft.id = tid;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, death_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Văn Tổ',
    'male',
    '1925-03-15',
    '2010-07-20',
    'Thế hệ gốc (dữ liệu mẫu)',
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
    'Vợ anh Trung',
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
    'Cháu nội',
    m3,
    m4
  )
  RETURNING id INTO m5;

  IF owner_uid IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.family_feed_posts WHERE family_tree_id = tid LIMIT 1) THEN
    INSERT INTO public.family_feed_posts (family_tree_id, author_id, body)
    VALUES (
      tid,
      owner_uid,
      'Chào cả nhà — đây là bài mẫu trên bảng tin dòng họ. Bạn có thể xóa và đăng nội dung mới.'
    );
  END IF;

  RAISE NOTICE 'seed_tree_7e6d5265: đã thêm 5 thành viên (+ bài tin nếu có owner) cho cây %', tid;
END $$;
