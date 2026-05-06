-- Tiếp tục mở rộng TK21: em ruột Lập + vợ/chồng & con của Thuỳ Dương.
-- Cần đã có nhánh TK21 (Minh An). Idempotent qua ghi chú riêng.

DO $$
DECLARE
  tid CONSTANT uuid := '7e6d5265-62f4-41b2-af10-7ebe057494d0'::uuid;
  v_trung uuid;
  v_doan uuid;
  v_quynh uuid;
  v_duong uuid;
  v_sp uuid;
  v_con uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.family_trees WHERE id = tid) THEN
    RAISE NOTICE 'extend_21c_more: không có cây % — bỏ qua', tid;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.family_tree_members
    WHERE family_tree_id = tid
      AND full_name = 'Nguyễn Minh An'
      AND notes = 'Con Lập — thế kỷ 21 (mẫu)'
    LIMIT 1
  ) THEN
    RAISE NOTICE 'extend_21c_more: chưa có nhánh TK21 (Minh An) — chạy migration 20260906120000 trước — bỏ qua';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.family_tree_members
    WHERE family_tree_id = tid
      AND notes = 'Em Lập — thế kỷ 21 (mẫu)'
    LIMIT 1
  ) THEN
    RAISE NOTICE 'extend_21c_more: đã mở rộng lần 2 — bỏ qua (cây %)', tid;
    RETURN;
  END IF;

  SELECT m.id
  INTO v_trung
  FROM public.family_tree_members m
  WHERE m.family_tree_id = tid
    AND m.full_name = 'Nguyễn Văn Trung'
    AND m.notes ILIKE '%dữ liệu mẫu%'
  ORDER BY m.created_at DESC
  LIMIT 1;

  SELECT m.id
  INTO v_doan
  FROM public.family_tree_members m
  WHERE m.family_tree_id = tid
    AND m.full_name = 'Lê Thị Đoan'
    AND m.notes ILIKE '%dữ liệu mẫu%'
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_trung IS NULL OR v_doan IS NULL THEN
    RAISE NOTICE 'extend_21c_more: không tìm thấy Trung/Đoan — bỏ qua';
    RETURN;
  END IF;

  INSERT INTO public.family_tree_members (
    family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
  )
  VALUES (
    tid,
    'Nguyễn Quỳnh Anh',
    'female',
    '2000-12-01',
    'Em Lập — thế kỷ 21 (mẫu)',
    v_trung,
    v_doan
  )
  RETURNING id INTO v_quynh;

  SELECT m.id
  INTO v_duong
  FROM public.family_tree_members m
  WHERE m.family_tree_id = tid
    AND m.full_name = 'Nguyễn Thuỳ Dương'
    AND m.notes = 'Con Lập — thế kỷ 21 (mẫu)'
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_duong IS NOT NULL THEN
    INSERT INTO public.family_tree_members (
      family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
    )
    VALUES (
      tid,
      'Ngô Đình Nam',
      'male',
      '2006-05-22',
      'Phối ngẫu Thuỳ Dương — mẫu TK21',
      NULL,
      NULL
    )
    RETURNING id INTO v_sp;

    UPDATE public.family_tree_members SET spouse_id = v_sp WHERE id = v_duong;
    UPDATE public.family_tree_members SET spouse_id = v_duong WHERE id = v_sp;

    INSERT INTO public.family_tree_members (
      family_tree_id, full_name, gender, birth_date, notes, father_id, mother_id
    )
    VALUES (
      tid,
      'Nguyễn Hoàng My',
      'female',
      '2016-09-14',
      'Con Thuỳ Dương — thế kỷ 21 (mẫu)',
      v_sp,
      v_duong
    )
    RETURNING id INTO v_con;
  END IF;

  RAISE NOTICE 'extend_21c_more: đã thêm nhánh phụ TK21 cho cây %', tid;
END $$;
