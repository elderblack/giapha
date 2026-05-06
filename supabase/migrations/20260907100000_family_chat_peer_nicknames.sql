-- Biệt danh chat: chỉ người đặt (viewer) thấy; peer phải là người được phép DM.

CREATE TABLE public.family_chat_peer_nicknames (
  viewer_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  peer_user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_user_id, peer_user_id),
  CONSTRAINT family_chat_peer_nicks_distinct CHECK (viewer_user_id <> peer_user_id),
  CONSTRAINT family_chat_peer_nicks_len CHECK (
    char_length(trim(nickname)) BETWEEN 1 AND 48
  )
);

CREATE INDEX idx_family_chat_peer_nicknames_viewer
  ON public.family_chat_peer_nicknames (viewer_user_id);

COMMENT ON TABLE public.family_chat_peer_nicknames IS
  'Biệt danh hiển thị trong chat: viewer đặt tên cục bộ cho peer; không đổi hồ sơ thật của peer.';

ALTER TABLE public.family_chat_peer_nicknames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_chat_peer_nicks_select_own"
  ON public.family_chat_peer_nicknames FOR SELECT
  TO authenticated
  USING (viewer_user_id = auth.uid());

CREATE POLICY "family_chat_peer_nicks_insert_own_eligible_peer"
  ON public.family_chat_peer_nicknames FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND peer_user_id <> viewer_user_id
    AND public.family_chat_may_message(viewer_user_id, peer_user_id)
  );

CREATE POLICY "family_chat_peer_nicks_update_own_eligible_peer"
  ON public.family_chat_peer_nicknames FOR UPDATE
  TO authenticated
  USING (viewer_user_id = auth.uid())
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND peer_user_id <> viewer_user_id
    AND public.family_chat_may_message(viewer_user_id, peer_user_id)
  );

CREATE POLICY "family_chat_peer_nicks_delete_own"
  ON public.family_chat_peer_nicknames FOR DELETE
  TO authenticated
  USING (viewer_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_chat_peer_nicknames TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.family_chat_peer_nicknames;
