-- Create the agency-branding storage bucket for agency logo uploads
-- Run this migration once against your Supabase project:
--   supabase db push  OR  paste into the Supabase SQL editor

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-branding',
  'agency-branding',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own logo
CREATE POLICY "agency_branding_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agency-branding');

CREATE POLICY "agency_branding_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'agency-branding');

CREATE POLICY "agency_branding_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agency-branding');

-- Allow public read access (logos are public URLs)
CREATE POLICY "agency_branding_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'agency-branding');
