-- Faster "bài viết của tôi" phân trang theo author
CREATE INDEX IF NOT EXISTS idx_family_feed_posts_author_created
  ON public.family_feed_posts (author_id, created_at DESC, id DESC);
