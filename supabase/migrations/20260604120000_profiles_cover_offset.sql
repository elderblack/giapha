-- Vị trí crop ảnh bìa hồ sơ (giống “chỉnh vị trí” Facebook): object-position %
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_offset_x REAL NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_offset_y REAL NOT NULL DEFAULT 50;

COMMENT ON COLUMN public.profiles.cover_offset_x IS 'Hiển thị ảnh bìa: hoành độ focal 0–100 (trái–phải).';
COMMENT ON COLUMN public.profiles.cover_offset_y IS 'Hiển thị ảnh bìa: trục dọc 0–100 (trên–dưới).';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cover_offset_x_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cover_offset_y_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_cover_offset_x_check CHECK (cover_offset_x >= 0 AND cover_offset_x <= 100);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_cover_offset_y_check CHECK (cover_offset_y >= 0 AND cover_offset_y <= 100);
