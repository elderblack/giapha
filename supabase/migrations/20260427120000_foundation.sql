-- GiaPhả Phase 1 — Foundation: core identity + waitlist + dòng họ (khung)
-- Bổ sung bảng chi tiết (posts, messages, …) ở các migration sau.

-- ---------------------------------------------------------------------------
-- Profiles (hồ sơ — gắn auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  date_of_birth DATE,
  gender TEXT,
  hometown TEXT,
  current_city TEXT,
  occupation TEXT,
  phone TEXT,
  profile_privacy TEXT NOT NULL DEFAULT 'family',
  dob_privacy TEXT NOT NULL DEFAULT 'family',
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  member_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON public.profiles (username) WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Waitlist (early access)
-- ---------------------------------------------------------------------------
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

CREATE INDEX idx_waitlist_created_at ON public.waitlist (created_at DESC);

-- ---------------------------------------------------------------------------
-- Dòng họ (khung cho phase sau)
-- ---------------------------------------------------------------------------
CREATE TABLE public.family_trees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  clan_name TEXT,
  origin_place TEXT,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.family_tree_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id UUID NOT NULL REFERENCES public.family_trees (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_tree_id, user_id)
);

CREATE INDEX idx_family_tree_roles_user ON public.family_tree_roles (user_id);
CREATE INDEX idx_family_tree_roles_tree ON public.family_tree_roles (family_tree_id);

-- Gắn profiles.member_id → members sẽ thêm ở migration cây gia phả (phase 3)
-- ALTER ... ADD CONSTRAINT khi bảng members tồn tại.

-- ---------------------------------------------------------------------------
-- Trigger: tạo profile khi đăng ký
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'Thành viên mới'
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_tree_roles ENABLE ROW LEVEL SECURITY;

-- Profiles: xem / sửa hồ sơ của chính mình
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert profile chỉ qua trigger (không cho insert trực tiếp từ client)
-- (Không tạo policy INSERT — Supabase mặc định từ chối nếu không có policy)

-- Waitlist: không cho đọc/ghi từ client; chỉ service role / Edge Functions
-- Không tạo policy → anon/authenticated không truy cập bảng.

-- Family trees: thành viên cùng dòng họ xem được; chỉnh sửa giai đoạn sau
CREATE POLICY "family_trees_select_member"
  ON public.family_trees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_tree_roles ftr
      WHERE ftr.family_tree_id = family_trees.id
        AND ftr.user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

CREATE POLICY "family_tree_roles_select_own"
  ON public.family_tree_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
