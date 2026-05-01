-- Realtime: refresh sau INSERT bài có thể chạy trước INSERT media — đồng bộ khi media được gắn.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.family_feed_post_media;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
