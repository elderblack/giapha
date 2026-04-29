-- Nhắc giỗ theo kỷ niệm ngày mất âm lịch (tùy chọn; mặc định vẫn dương).

ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS memorial_reminder_use_lunar BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.family_tree_members.memorial_reminder_use_lunar IS
  'True: Edge memorial-reminders dùng ngày kỷ niệm âm lịch (suy ra từ death_date + hệ âm Trung–Việt). False: kỷ niệm dương như cũ.';
