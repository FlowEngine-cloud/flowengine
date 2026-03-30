-- FlowEngine Portal - Optional Seed Data
-- Run this after supabase-schema.sql to add sample templates

-- Sample workflow templates (only insert if no templates exist yet)
INSERT INTO workflow_templates (name, description, category, is_public, workflow_json)
SELECT name, description, category, is_public, workflow_json FROM (VALUES
  ('Welcome Email Sequence', 'Send a welcome email when a new user signs up, followed by an onboarding series.', 'Email', true, '{"nodes": [], "connections": {}}'),
  ('Slack Notification Bot', 'Post formatted notifications to Slack channels based on webhook triggers.', 'Communication', true, '{"nodes": [], "connections": {}}'),
  ('Lead Capture Form', 'Capture leads from a web form and add them to your CRM automatically.', 'Sales', true, '{"nodes": [], "connections": {}}'),
  ('Daily Report Generator', 'Generate and email a daily summary report from your database.', 'Reporting', true, '{"nodes": [], "connections": {}}'),
  ('Invoice Automation', 'Create and send invoices automatically when a project milestone is completed.', 'Finance', true, '{"nodes": [], "connections": {}}')
) AS v(name, description, category, is_public, workflow_json)
WHERE NOT EXISTS (SELECT 1 FROM workflow_templates WHERE is_public = true AND team_id IS NULL);

-- Storage bucket for agency branding (logo uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-branding',
  'agency-branding',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/update/delete their own logos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agency_branding_upload' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY agency_branding_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agency-branding');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agency_branding_update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY agency_branding_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agency-branding');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agency_branding_delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY agency_branding_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agency-branding');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agency_branding_public_read' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY agency_branding_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'agency-branding');
  END IF;
END $$;
