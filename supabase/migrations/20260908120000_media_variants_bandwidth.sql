-- Media variants for bandwidth: thumb/medium/poster paths + optional bucket for cross-bucket feed rows.

-- ---------------------------------------------------------------------------
-- family_feed_post_media
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_feed_post_media
  ADD COLUMN IF NOT EXISTS thumb_path TEXT,
  ADD COLUMN IF NOT EXISTS medium_path TEXT,
  ADD COLUMN IF NOT EXISTS poster_path TEXT,
  ADD COLUMN IF NOT EXISTS media_width INTEGER,
  ADD COLUMN IF NOT EXISTS media_height INTEGER,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'family-feed-media';

COMMENT ON COLUMN public.family_feed_post_media.storage_bucket IS
  'Bucket chứa storage_path (gốc). Dùng profile-media khi bài chỉ trỏ file đã upload ở hồ sơ.';

UPDATE public.family_feed_post_media
SET
  thumb_path = COALESCE(thumb_path, storage_path),
  medium_path = COALESCE(medium_path, storage_path)
WHERE thumb_path IS NULL OR medium_path IS NULL;

-- ---------------------------------------------------------------------------
-- profiles — thumb paths (profile-media bucket), URL gốc giữ nguyên avatar_url/cover_url
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_thumb_path TEXT,
  ADD COLUMN IF NOT EXISTS cover_thumb_path TEXT;

-- ---------------------------------------------------------------------------
-- family_chat_messages — thumb for list bubbles
-- ---------------------------------------------------------------------------
ALTER TABLE public.family_chat_messages
  ADD COLUMN IF NOT EXISTS attachment_thumb_path TEXT;

UPDATE public.family_chat_messages
SET attachment_thumb_path = COALESCE(attachment_thumb_path, attachment_path)
WHERE attachment_path IS NOT NULL AND attachment_thumb_path IS NULL;
