-- gen_random_bytes is from pgcrypto, installed in schema "extensions" on Supabase.
-- Previous definition used SET search_path = public only, so the RPC failed at runtime.

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
