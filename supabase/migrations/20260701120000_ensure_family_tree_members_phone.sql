-- Đảm bảo cột phone + helper (chạy an toàn nếu migration 20260630120000 chưa được áp dụng trên DB).

ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.family_tree_members.phone IS 'Số điện thoại (ưu tiên E.164); dùng khi chủ/biên tập cấp tài khoản mật khẩu';

CREATE INDEX IF NOT EXISTS idx_family_tree_members_phone_lower
  ON public.family_tree_members (lower(trim(phone)))
  WHERE phone IS NOT NULL AND trim(phone) <> '';

CREATE OR REPLACE FUNCTION public.auth_user_id_by_phone(p_phone TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id
  FROM auth.users
  WHERE phone IS NOT NULL AND phone = trim(both from p_phone)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_by_phone(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_id_by_phone(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.auth_user_id_by_phone(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_phone(TEXT) TO service_role;
