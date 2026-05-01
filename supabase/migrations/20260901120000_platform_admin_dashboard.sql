-- Bảng quản trị nền tảng + RPC đọc số liệu (SECURITY DEFINER).
-- Không có policy SELECT cho authenticated → client không đọc trực tiếp bảng.
-- Thêm người vận hành (một lần, trong SQL Editor Supabase — role postgres/superuser):
--   INSERT INTO public.platform_admins (user_id) VALUES ('<uuid auth.users>');
-- Xoá admin: DELETE FROM public.platform_admins WHERE user_id = '<uuid>';

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.platform_admins IS 'Ai có user_id trong bảng này được vào dashboard admin (/app/admin) và gọi RPC số liệu.';

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Không tạo policy → anon/authenticated không SELECT/INSERT/UPDATE/DELETE qua PostgREST.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins p
    WHERE p.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary()
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  ok  BOOLEAN;
  wl  JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.user_id = uid) INTO ok;
  IF NOT COALESCE(ok, FALSE) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', w.id::text,
          'email', w.email,
          'name', w.name,
          'phone', w.phone,
          'referrer', w.referrer,
          'created_at', w.created_at
        )
        ORDER BY w.created_at DESC
      )
      FROM (
        SELECT id, email, name, phone, referrer, created_at
        FROM public.waitlist
        ORDER BY created_at DESC
        LIMIT 80
      ) w
    ),
    '[]'::jsonb
  )
  INTO wl;

  RETURN jsonb_build_object(
    'profiles', (SELECT COUNT(*)::bigint FROM public.profiles),
    'trees', (SELECT COUNT(*)::bigint FROM public.family_trees),
    'tree_members', (SELECT COUNT(*)::bigint FROM public.family_tree_members),
    'tree_roles', (SELECT COUNT(*)::bigint FROM public.family_tree_roles),
    'waitlist', (SELECT COUNT(*)::bigint FROM public.waitlist),
    'feed_posts', (SELECT COUNT(*)::bigint FROM public.family_feed_posts),
    'chat_conversations', (SELECT COUNT(*)::bigint FROM public.family_chat_conversations),
    'waitlist_rows', COALESCE(wl, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_summary() TO authenticated;
