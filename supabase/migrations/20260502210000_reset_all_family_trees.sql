-- Reset dữ liệu dòng họ (staging/dev hoặc khi cần làm trống sandbox).
--
-- Luật “chỉ tạo hoặc tham gia đúng một dòng họ” đã được áp bởi:
--   - UNIQUE (user_id) trên public.family_tree_roles (20260430160000)
--   - TRIGGER family_trees_one_role_per_user_trg (chặn INSERT family_trees nếu user đã có role)
--   - RPC public.create_family_tree / public.join_family_tree (kiểm tra đã thuộc cây khác)
--
-- Trước khi xóa cây: bỏ liên kết profiles.member_id → node (cột không có FK bắt buộc).

UPDATE public.profiles
SET member_id = NULL
WHERE member_id IS NOT NULL;

-- Toàn bộ phụ thuộc CASCADE: roles, members (cha/mẹ, vợ/chồng), yêu cầu, lời mời liên kết email, …
DELETE FROM public.family_trees;
