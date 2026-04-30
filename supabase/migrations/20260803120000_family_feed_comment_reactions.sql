-- Cảm xúc trên bình luận bảng tin (cùng enum với family_feed_post_reactions).

CREATE TABLE IF NOT EXISTS public.family_feed_comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.family_feed_comments (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.family_feed_reaction_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_feed_comment_reactions_comment
  ON public.family_feed_comment_reactions (comment_id);

ALTER TABLE public.family_feed_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_feed_cr_select_member" ON public.family_feed_comment_reactions;
DROP POLICY IF EXISTS "family_feed_cr_insert_self_member" ON public.family_feed_comment_reactions;
DROP POLICY IF EXISTS "family_feed_cr_update_self" ON public.family_feed_comment_reactions;
DROP POLICY IF EXISTS "family_feed_cr_delete_self" ON public.family_feed_comment_reactions;

CREATE POLICY "family_feed_cr_select_member"
  ON public.family_feed_comment_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_feed_comments c
      INNER JOIN public.family_feed_posts p ON p.id = c.post_id
      INNER JOIN (
        SELECT r.family_tree_id FROM public.family_tree_roles r WHERE r.user_id = auth.uid()
      ) xr ON xr.family_tree_id = p.family_tree_id
      WHERE c.id = family_feed_comment_reactions.comment_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.family_feed_comments c
      INNER JOIN public.family_feed_posts p ON p.id = c.post_id
      INNER JOIN public.family_trees ft ON ft.id = p.family_tree_id AND ft.owner_id = auth.uid()
      WHERE c.id = family_feed_comment_reactions.comment_id
    )
  );

CREATE POLICY "family_feed_cr_insert_self_member"
  ON public.family_feed_comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.family_feed_comments c
      INNER JOIN public.family_feed_posts p ON p.id = c.post_id
      WHERE c.id = family_feed_comment_reactions.comment_id
        AND (
          EXISTS (
            SELECT 1 FROM public.family_tree_roles r
            WHERE r.family_tree_id = p.family_tree_id AND r.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.family_trees ft
            WHERE ft.id = p.family_tree_id AND ft.owner_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "family_feed_cr_update_self"
  ON public.family_feed_comment_reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "family_feed_cr_delete_self"
  ON public.family_feed_comment_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
