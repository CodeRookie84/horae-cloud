-- =============================================================
-- Team Talk — photo upload (camera + gallery), mirroring the
-- existing chat-voice-messages bucket setup for images.
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow all chat-images" ON storage.objects;
CREATE POLICY "Allow all chat-images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'chat-images')
  WITH CHECK (bucket_id = 'chat-images');

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_width INT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_height INT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS image_mime_type TEXT;
