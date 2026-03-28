-- Storage bucket for visual MCQ prompt images (admin upload from Prompts > Image / definition).
INSERT INTO storage.buckets (id, name, public)
VALUES ('prompt-images', 'prompt-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload (admin flow uses auth).
DROP POLICY IF EXISTS "prompt_images_upload" ON storage.objects;
CREATE POLICY "prompt_images_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'prompt-images');

DROP POLICY IF EXISTS "prompt_images_select" ON storage.objects;
CREATE POLICY "prompt_images_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'prompt-images');
