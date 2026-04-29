-- Phase 3 — Mời liên kết node qua email (token có hạn) + Âm lịch / giỗ (text hiển thị)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Lunar / giỗ (ghi chú bổ sung, không thay DATE dương)
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_tree_members
  ADD COLUMN IF NOT EXISTS birth_lunar_text TEXT,
  ADD COLUMN IF NOT EXISTS death_lunar_text TEXT,
  ADD COLUMN IF NOT EXISTS memorial_note TEXT;

COMMENT ON COLUMN public.family_tree_members.birth_lunar_text IS 'Ngày sinh âm lịch hiển thị (vd. 15/3 âm)';
COMMENT ON COLUMN public.family_tree_members.death_lunar_text IS 'Ngày mất âm lịch hiển thị';
COMMENT ON COLUMN public.family_tree_members.memorial_note IS 'Ghi nhớ giỗ: ngày âm hay lời nhắc';

-- ---------------------------------------------------------------------------
-- Lời mời liên kết (token one-time trong email)
-- ---------------------------------------------------------------------------
CREATE TABLE public.family_tree_member_link_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id UUID NOT NULL REFERENCES public.family_trees (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.family_tree_members (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT ft_link_inv_unique_hash UNIQUE (token_hash)
);

CREATE INDEX idx_ft_link_inv_tree_member ON public.family_tree_member_link_invites (family_tree_id, member_id);
CREATE INDEX idx_ft_link_inv_email ON public.family_tree_member_link_invites (lower(email));

ALTER TABLE public.family_tree_member_link_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_link_inv_none_client"
  ON public.family_tree_member_link_invites
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ft_hash_invite_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex')
$$;

-- Chỉ chủ hoặc biên tập viên; node chưa liên kết; email hợp lệ
CREATE OR REPLACE FUNCTION public.create_family_tree_member_link_invite(p_member_id UUID, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tree UUID;
  v_linked UUID;
  v_email TEXT;
  v_raw TEXT;
  v_hash TEXT;
  v_exp TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_email := lower(trim(p_email));
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  SELECT family_tree_id, linked_profile_id
  INTO v_tree, v_linked
  FROM public.family_tree_members WHERE id = p_member_id;

  IF v_tree IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_linked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.family_trees ft WHERE ft.id = v_tree AND ft.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles r
      WHERE r.family_tree_id = v_tree AND r.user_id = auth.uid() AND r.role = 'editor'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := public.ft_hash_invite_token(v_raw);
  v_exp := NOW() + INTERVAL '14 days';

  INSERT INTO public.family_tree_member_link_invites (
    family_tree_id, member_id, email, token_hash, expires_at, created_by
  ) VALUES (v_tree, p_member_id, v_email, v_hash, v_exp, auth.uid());

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_raw,
    'expires_at', v_exp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_family_tree_member_link_invite(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_family_tree_member_link_invite(UUID, TEXT) TO authenticated;

-- Người nhận: email tài khoản trùng lời mời → tham gia cây (member) + liên kết node
CREATE OR REPLACE FUNCTION public.claim_family_tree_member_via_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  r RECORD;
  v_acc_email TEXT;
  v_tree UUID;
  v_linked UUID;
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF trim(COALESCE(p_token, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_hash := public.ft_hash_invite_token(trim(p_token));

  SELECT * INTO r
  FROM public.family_tree_member_link_invites
  WHERE token_hash = v_hash
    AND consumed_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT lower(trim(email::text)) INTO v_acc_email FROM auth.users WHERE id = auth.uid();
  IF v_acc_email IS NULL OR v_acc_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'need_email_account');
  END IF;

  IF lower(trim(r.email)) IS DISTINCT FROM v_acc_email THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'email_mismatch',
      'invite_email_masked', substring(r.email, 1, 2) || '***'
    );
  END IF;

  SELECT m.family_tree_id, m.linked_profile_id
  INTO v_tree, v_linked
  FROM public.family_tree_members m
  WHERE m.id = r.member_id;

  IF v_tree IS NULL OR v_tree IS DISTINCT FROM r.family_tree_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_linked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_linked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_tree_members m2
    WHERE m2.family_tree_id = v_tree AND m2.linked_profile_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed_other');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_tree_roles r2
    WHERE r2.user_id = auth.uid()
      AND r2.family_tree_id IS DISTINCT FROM v_tree
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_in_another_tree');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_trees ft
    WHERE ft.id = v_tree AND ft.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.family_tree_roles ftr
    WHERE ftr.family_tree_id = v_tree AND ftr.user_id = auth.uid()
  ) THEN
    INSERT INTO public.family_tree_roles (family_tree_id, user_id, role)
    VALUES (v_tree, auth.uid(), 'member')
    ON CONFLICT (family_tree_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.family_tree_members
  SET linked_profile_id = auth.uid()
  WHERE id = r.member_id;

  UPDATE public.family_tree_member_link_invites
  SET consumed_at = NOW(), consumed_by = auth.uid()
  WHERE id = r.id;

  RETURN jsonb_build_object(
    'ok', true,
    'family_tree_id', v_tree,
    'member_id', r.member_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_family_tree_member_via_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_family_tree_member_via_invite(TEXT) TO authenticated;
