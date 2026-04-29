-- Phase 3 — Nhắc giỗ định kỳ (email, theo ngày dương lịch = kỷ niệm ngày mất; múi giờ VN)
-- Gọi Edge Function `memorial-reminders` hằng ngày với JWT service_role (vd. pg_cron + vault hoặc scheduler bên ngoài).

ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS memorial_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS memorial_reminder_days_before SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.family_tree_members DROP CONSTRAINT IF EXISTS family_tree_members_memorial_reminder_days_chk;
ALTER TABLE public.family_tree_members
  ADD CONSTRAINT family_tree_members_memorial_reminder_days_chk CHECK (
    memorial_reminder_days_before >= 0 AND memorial_reminder_days_before <= 30
  );

COMMENT ON COLUMN public.family_tree_members.memorial_reminder_enabled IS
  'Bật gửi email nhắc giỗ (theo kỷ niệm ngày mất dương lịch, Asia/Ho_Chi_Minh).';
COMMENT ON COLUMN public.family_tree_members.memorial_reminder_days_before IS
  'Nhắc trước N ngày so với ngày kỷ niệm mất (dương); 0 = đúng ngày kỷ niệm.';

CREATE TABLE IF NOT EXISTS public.memorial_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  family_tree_member_id UUID NOT NULL REFERENCES public.family_tree_members (id) ON DELETE CASCADE,
  remind_for_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  UNIQUE (family_tree_member_id, remind_for_date)
);

CREATE INDEX IF NOT EXISTS idx_memorial_reminder_log_remind_date ON public.memorial_reminder_log (remind_for_date DESC);

COMMENT ON TABLE public.memorial_reminder_log IS
  'Tránh gửi trùng nhắc giỗ: một bản ghi / thành viên / ngày nhắc (lịch VN).';

ALTER TABLE public.memorial_reminder_log ENABLE ROW LEVEL SECURITY;

-- Danh sách email nhận nhắc: mọi tài khoản có role trong dòng họ (chủ / biên tập / thành viên).
CREATE OR REPLACE FUNCTION public.app_tree_reminder_recipient_emails (p_family_tree_id UUID)
RETURNS SETOF TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    x.email
  FROM (
    SELECT
      lower(trim(BOTH FROM u.email::text)) AS email
    FROM public.family_tree_roles r
    JOIN auth.users u ON u.id = r.user_id
    WHERE
      r.family_tree_id = p_family_tree_id
      AND u.email IS NOT NULL
      AND length(trim(BOTH FROM u.email::text)) > 0
    UNION
    SELECT
      lower(trim(BOTH FROM u.email::text))
    FROM public.family_trees t
    JOIN auth.users u ON u.id = t.owner_id
    WHERE
      t.id = p_family_tree_id
      AND u.email IS NOT NULL
      AND length(trim(BOTH FROM u.email::text)) > 0
  ) x
  WHERE x.email IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.app_tree_reminder_recipient_emails (UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_tree_reminder_recipient_emails (UUID) TO service_role;
