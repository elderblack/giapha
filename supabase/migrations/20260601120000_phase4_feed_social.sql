-- Phase 4 — Bảng tin / phản hồi / bình luận / kết nối / thông báo (theo domain family_tree).

-- ---------------------------------------------------------------------------
-- Enums & bảng
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.family_feed_reaction_kind AS ENUM (
    'like', 'love', 'haha', 'wow', 'sad', 'angry'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.family_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_tree_id UUID NOT NULL REFERENCES public.family_trees (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.family_feed_posts IS
  'Ứng dụng chỉ đăng khi có nội dung hoặc file đính kèm; media được gắn sau INSERT bài.';

CREATE INDEX IF NOT EXISTS idx_family_feed_posts_tree_created ON public.family_feed_posts (family_tree_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.family_feed_post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.family_feed_posts (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_feed_post_media_path_uidx ON public.family_feed_post_media (storage_path);
CREATE INDEX IF NOT EXISTS idx_family_feed_post_media_post ON public.family_feed_post_media (post_id, sort_order);

CREATE TABLE IF NOT EXISTS public.family_feed_post_reactions (
  post_id UUID NOT NULL REFERENCES public.family_feed_posts (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind public.family_feed_reaction_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_feed_reactions_post ON public.family_feed_post_reactions (post_id);

CREATE TABLE IF NOT EXISTS public.family_feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.family_feed_posts (id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.family_feed_comments (id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (LENGTH(TRIM(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_feed_comments_post ON public.family_feed_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_family_feed_comments_parent ON public.family_feed_comments (post_id, parent_comment_id);

CREATE TABLE IF NOT EXISTS public.family_feed_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT family_feed_follows_not_self_ck CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.family_friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT family_friend_requests_not_self_ck CHECK (from_id <> to_id),
  UNIQUE (from_id, to_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_pending ON public.family_friend_requests (to_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON public.family_friend_requests (from_id);

CREATE TABLE IF NOT EXISTS public.family_friendships (
  user_low UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  user_high UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT family_friendships_order_ck CHECK (user_low < user_high),
  PRIMARY KEY (user_low, user_high)
);

CREATE TABLE IF NOT EXISTS public.family_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  family_tree_id UUID REFERENCES public.family_trees (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_notifications_recipient_recent ON public.family_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_notifications_unread ON public.family_notifications (user_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Triggers updated_at & bình luận 1 cấp
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS family_feed_posts_updated_at_trg ON public.family_feed_posts;
CREATE TRIGGER family_feed_posts_updated_at_trg
  BEFORE UPDATE ON public.family_feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS family_feed_comments_updated_at_trg ON public.family_feed_comments;
CREATE TRIGGER family_feed_comments_updated_at_trg
  BEFORE UPDATE ON public.family_feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.family_feed_comment_one_level_chk()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.family_feed_comments p
  WHERE p.id = NEW.parent_comment_id
    AND p.post_id = NEW.post_id
    AND p.parent_comment_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_comment must be top-level reply for this tree feed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_feed_comment_one_level_trg ON public.family_feed_comments;
CREATE TRIGGER family_feed_comment_one_level_trg
  BEFORE INSERT OR UPDATE ON public.family_feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_comment_one_level_chk();

-- ---------------------------------------------------------------------------
-- Thông báo (chèn từ trigger SECURITY DEFINER — không cho INSERT client)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.family_feed_notify_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient UUID;
BEGIN
  FOR recipient IN
    SELECT r.user_id
    FROM public.family_tree_roles r
    WHERE r.family_tree_id = NEW.family_tree_id
      AND r.user_id IS DISTINCT FROM NEW.author_id
    UNION
    SELECT ft.owner_id
    FROM public.family_trees ft
    WHERE ft.id = NEW.family_tree_id
      AND ft.owner_id IS NOT NULL
      AND ft.owner_id IS DISTINCT FROM NEW.author_id
      AND NOT EXISTS (
        SELECT 1 FROM public.family_tree_roles r2
        WHERE r2.family_tree_id = NEW.family_tree_id AND r2.user_id = ft.owner_id
      )
  LOOP
    INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
    VALUES (
      recipient,
      'post_created',
      jsonb_build_object('post_id', NEW.id, 'author_id', NEW.author_id),
      NEW.family_tree_id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_feed_posts_notify_members_trg ON public.family_feed_posts;
CREATE TRIGGER family_feed_posts_notify_members_trg
  AFTER INSERT ON public.family_feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_notify_post_created();

CREATE OR REPLACE FUNCTION public.family_feed_notify_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author UUID;
  v_tree UUID;
BEGIN
  SELECT posts.author_id, posts.family_tree_id INTO v_author, v_tree
  FROM public.family_feed_posts posts
  WHERE posts.id = NEW.post_id;

  IF v_author IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id <> v_author THEN
    INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
    VALUES (
      v_author,
      'post_reacted',
      jsonb_build_object('post_id', NEW.post_id, 'by_user_id', NEW.user_id, 'kind', NEW.kind::text),
      v_tree
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_feed_post_reactions_notify_trg ON public.family_feed_post_reactions;
CREATE TRIGGER family_feed_post_reactions_notify_trg
  AFTER INSERT ON public.family_feed_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_notify_reaction();

CREATE OR REPLACE FUNCTION public.family_feed_notify_reaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author UUID;
  v_tree UUID;
BEGIN
  IF OLD.kind = NEW.kind THEN
    RETURN NEW;
  END IF;

  SELECT posts.author_id, posts.family_tree_id INTO v_author, v_tree
  FROM public.family_feed_posts posts
  WHERE posts.id = NEW.post_id;

  IF v_author IS NOT NULL AND NEW.user_id <> v_author THEN
    INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
    VALUES (
      v_author,
      'post_reacted',
      jsonb_build_object('post_id', NEW.post_id, 'by_user_id', NEW.user_id, 'kind', NEW.kind::text),
      v_tree
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_feed_post_reactions_update_notify_trg ON public.family_feed_post_reactions;
CREATE TRIGGER family_feed_post_reactions_update_notify_trg
  AFTER UPDATE ON public.family_feed_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_notify_reaction_update();

CREATE OR REPLACE FUNCTION public.family_feed_notify_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author UUID;
  v_tree UUID;
  v_parent_author UUID;
BEGIN
  SELECT p.author_id, p.family_tree_id INTO v_post_author, v_tree
  FROM public.family_feed_posts p
  WHERE p.id = NEW.post_id;

  IF NEW.parent_comment_id IS NULL THEN
    IF v_post_author IS NOT NULL AND NEW.author_id <> v_post_author THEN
      INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
      VALUES (
        v_post_author,
        'comment_on_post',
        jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'by_user_id', NEW.author_id),
        v_tree
      );
    END IF;
    RETURN NEW;
  END IF;

  SELECT pc.author_id INTO v_parent_author
  FROM public.family_feed_comments pc
  WHERE pc.id = NEW.parent_comment_id;

  IF v_parent_author IS NOT NULL AND NEW.author_id <> v_parent_author THEN
    INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
    VALUES (
      v_parent_author,
      'reply_to_comment',
      jsonb_build_object(
        'post_id', NEW.post_id,
        'comment_id', NEW.id,
        'parent_comment_id', NEW.parent_comment_id,
        'by_user_id', NEW.author_id
      ),
      v_tree
    );
  END IF;

  IF v_post_author IS NOT NULL
     AND v_post_author IS DISTINCT FROM NEW.author_id
     AND v_post_author IS DISTINCT FROM v_parent_author THEN
    INSERT INTO public.family_notifications (user_id, kind, payload, family_tree_id)
    VALUES (
      v_post_author,
      'comment_on_post_reply',
      jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id, 'by_user_id', NEW.author_id),
      v_tree
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_feed_comments_notify_trg ON public.family_feed_comments;
CREATE TRIGGER family_feed_comments_notify_trg
  AFTER INSERT ON public.family_feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_notify_comment();

CREATE OR REPLACE FUNCTION public.family_feed_notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.family_notifications (user_id, kind, payload)
    VALUES (
      NEW.to_id,
      'friend_request',
      jsonb_build_object('request_id', NEW.id, 'from_id', NEW.from_id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.family_notifications (user_id, kind, payload)
    VALUES (
      NEW.from_id,
      'friend_request_accepted',
      jsonb_build_object('request_id', NEW.id, 'by_user_id', NEW.to_id)
    );
    INSERT INTO public.family_friendships (user_low, user_high)
    VALUES (
      LEAST(NEW.from_id, NEW.to_id),
      GREATEST(NEW.from_id, NEW.to_id)
    )
    ON CONFLICT (user_low, user_high) DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_friend_requests_notify_trg ON public.family_friend_requests;
CREATE TRIGGER family_friend_requests_notify_trg
  AFTER INSERT OR UPDATE ON public.family_friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.family_feed_notify_friend_request();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feed_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feed_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_feed_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_feed_posts_select_tree_member" ON public.family_feed_posts;
DROP POLICY IF EXISTS "family_feed_posts_insert_tree_member" ON public.family_feed_posts;
DROP POLICY IF EXISTS "family_feed_posts_update_author" ON public.family_feed_posts;
DROP POLICY IF EXISTS "family_feed_posts_delete_author_or_editor" ON public.family_feed_posts;
DROP POLICY IF EXISTS "family_feed_media_select_same_tree_as_post" ON public.family_feed_post_media;
DROP POLICY IF EXISTS "family_feed_media_insert_author_post" ON public.family_feed_post_media;
DROP POLICY IF EXISTS "family_feed_media_delete_author_post" ON public.family_feed_post_media;
DROP POLICY IF EXISTS "family_feed_r_select_tree_member" ON public.family_feed_post_reactions;
DROP POLICY IF EXISTS "family_feed_r_insert_self_member" ON public.family_feed_post_reactions;
DROP POLICY IF EXISTS "family_feed_r_update_self" ON public.family_feed_post_reactions;
DROP POLICY IF EXISTS "family_feed_r_delete_self" ON public.family_feed_post_reactions;
DROP POLICY IF EXISTS "family_feed_c_select_member" ON public.family_feed_comments;
DROP POLICY IF EXISTS "family_feed_c_insert_member" ON public.family_feed_comments;
DROP POLICY IF EXISTS "family_feed_c_update_author" ON public.family_feed_comments;
DROP POLICY IF EXISTS "family_feed_c_delete_author_or_editor" ON public.family_feed_comments;
DROP POLICY IF EXISTS "family_follows_select_own" ON public.family_feed_follows;
DROP POLICY IF EXISTS "family_follows_insert_self" ON public.family_feed_follows;
DROP POLICY IF EXISTS "family_follows_delete_self" ON public.family_feed_follows;
DROP POLICY IF EXISTS "friend_req_select_own" ON public.family_friend_requests;
DROP POLICY IF EXISTS "friend_req_insert_from_self" ON public.family_friend_requests;
DROP POLICY IF EXISTS "friend_req_update_recipient" ON public.family_friend_requests;
DROP POLICY IF EXISTS "friend_req_update_sender_cancel" ON public.family_friend_requests;
DROP POLICY IF EXISTS "friendships_select_participant" ON public.family_friendships;
DROP POLICY IF EXISTS "family_notif_select_own" ON public.family_notifications;
DROP POLICY IF EXISTS "family_notif_update_read_own" ON public.family_notifications;
DROP POLICY IF EXISTS "family_feed_storage_select_member" ON storage.objects;
DROP POLICY IF EXISTS "family_feed_storage_select_owner_trees" ON storage.objects;
DROP POLICY IF EXISTS "family_feed_storage_insert_own_under_tree" ON storage.objects;
DROP POLICY IF EXISTS "family_feed_storage_delete_own_or_editor" ON storage.objects;

-- member / owner xem & tạo bài trong cùng dòng họ
CREATE POLICY "family_feed_posts_select_tree_member"
  ON public.family_feed_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_tree_roles r
      WHERE r.family_tree_id = family_feed_posts.family_tree_id
        AND r.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_feed_posts.family_tree_id
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_feed_posts_insert_tree_member"
  ON public.family_feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.family_tree_roles r
        WHERE r.family_tree_id = family_feed_posts.family_tree_id
          AND r.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.family_trees ft
        WHERE ft.id = family_feed_posts.family_tree_id
          AND ft.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "family_feed_posts_update_author"
  ON public.family_feed_posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "family_feed_posts_delete_author_or_editor"
  ON public.family_feed_posts FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = family_feed_posts.family_tree_id
        AND ft.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.family_tree_roles r
      WHERE r.family_tree_id = family_feed_posts.family_tree_id
        AND r.user_id = auth.uid()
        AND r.role = 'editor'
    )
  );

-- Media
CREATE POLICY "family_feed_media_select_same_tree_as_post"
  ON public.family_feed_post_media FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_post_media.post_id
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

CREATE POLICY "family_feed_media_insert_author_post"
  ON public.family_feed_post_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_post_media.post_id
        AND p.author_id = auth.uid()
    )
  );

CREATE POLICY "family_feed_media_delete_author_post"
  ON public.family_feed_post_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_post_media.post_id
        AND (
          p.author_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.family_trees ft
            WHERE ft.id = p.family_tree_id AND ft.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.family_tree_roles r
            WHERE r.family_tree_id = p.family_tree_id
              AND r.user_id = auth.uid()
              AND r.role = 'editor'
          )
        )
    )
  );

-- Reactions
CREATE POLICY "family_feed_r_select_tree_member"
  ON public.family_feed_post_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      INNER JOIN (
        SELECT r.family_tree_id FROM public.family_tree_roles r WHERE r.user_id = auth.uid()
      ) xr ON xr.family_tree_id = p.family_tree_id
      WHERE p.id = family_feed_post_reactions.post_id
    )
    OR EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      INNER JOIN public.family_trees ft ON ft.id = p.family_tree_id AND ft.owner_id = auth.uid()
      WHERE p.id = family_feed_post_reactions.post_id
    )
  );

CREATE POLICY "family_feed_r_insert_self_member"
  ON public.family_feed_post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_post_reactions.post_id
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

CREATE POLICY "family_feed_r_update_self"
  ON public.family_feed_post_reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "family_feed_r_delete_self"
  ON public.family_feed_post_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Comments
CREATE POLICY "family_feed_c_select_member"
  ON public.family_feed_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_comments.post_id
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

CREATE POLICY "family_feed_c_insert_member"
  ON public.family_feed_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      WHERE p.id = family_feed_comments.post_id
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

CREATE POLICY "family_feed_c_update_author"
  ON public.family_feed_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "family_feed_c_delete_author_or_editor"
  ON public.family_feed_comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      INNER JOIN public.family_trees ft ON ft.id = p.family_tree_id AND ft.owner_id = auth.uid()
      WHERE p.id = family_feed_comments.post_id
    )
    OR EXISTS (
      SELECT 1 FROM public.family_feed_posts p
      INNER JOIN public.family_tree_roles r ON r.family_tree_id = p.family_tree_id
        AND r.user_id = auth.uid()
        AND r.role = 'editor'
      WHERE p.id = family_feed_comments.post_id
    )
  );

-- Follow — chỉ sở hữu cặp
CREATE POLICY "family_follows_select_own"
  ON public.family_feed_follows FOR SELECT
  TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

CREATE POLICY "family_follows_insert_self"
  ON public.family_feed_follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "family_follows_delete_self"
  ON public.family_feed_follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid ());

-- Friend requests
CREATE POLICY "friend_req_select_own"
  ON public.family_friend_requests FOR SELECT
  TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE POLICY "friend_req_insert_from_self"
  ON public.family_friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_id = auth.uid());

CREATE POLICY "friend_req_update_recipient"
  ON public.family_friend_requests FOR UPDATE
  TO authenticated
  USING (to_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    to_id = auth.uid()
    AND status IN ('accepted', 'rejected')
  );

CREATE POLICY "friend_req_update_sender_cancel"
  ON public.family_friend_requests FOR UPDATE
  TO authenticated
  USING (from_id = auth.uid() AND status = 'pending')
  WITH CHECK (from_id = auth.uid() AND status = 'cancelled');

-- Friendship: đọc nếu mình trong cặp
CREATE POLICY "friendships_select_participant"
  ON public.family_friendships FOR SELECT
  TO authenticated
  USING (user_low = auth.uid() OR user_high = auth.uid());

-- Notifications: chỉ người nhận đọc / đánh đọc
CREATE POLICY "family_notif_select_own"
  ON public.family_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "family_notif_update_read_own"
  ON public.family_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage bucket tin dòng họ
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'family-feed-media',
  'family-feed-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "family_feed_storage_select_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'family-feed-media'
    AND EXISTS (
      SELECT 1 FROM public.family_tree_roles r
      WHERE r.family_tree_id = ((storage.foldername (name))[1])::uuid
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "family_feed_storage_select_owner_trees"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'family-feed-media'
    AND EXISTS (
      SELECT 1 FROM public.family_trees ft
      WHERE ft.id = ((storage.foldername (name))[1])::uuid
        AND ft.owner_id = auth.uid()
    )
  );

CREATE POLICY "family_feed_storage_insert_own_under_tree"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'family-feed-media'
    AND (storage.foldername (name))[2] = auth.uid()::text
    AND (
      (storage.foldername (name))[1]::uuid IN (SELECT public.family_tree_ids_for_me ())
      OR EXISTS (
        SELECT 1 FROM public.family_trees ft
        WHERE ft.id = ((storage.foldername (name))[1])::uuid AND ft.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "family_feed_storage_delete_own_or_editor"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'family-feed-media'
    AND (
      (storage.foldername (name))[2] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.family_tree_roles r
        WHERE r.family_tree_id = ((storage.foldername (name))[1])::uuid
          AND r.user_id = auth.uid()
          AND r.role = 'editor'
      )
      OR EXISTS (
        SELECT 1 FROM public.family_trees ft
        WHERE ft.id = ((storage.foldername (name))[1])::uuid AND ft.owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Supabase Realtime (thông báo)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_feed_posts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
