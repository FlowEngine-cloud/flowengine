-- FlowEngine Portal - Optional Seed Data
-- Run this after supabase-schema.sql to add sample templates

-- Sample workflow templates
INSERT INTO workflow_templates (name, description, category, is_public, workflow_json) VALUES
  ('Welcome Email Sequence', 'Send a welcome email when a new user signs up, followed by an onboarding series.', 'Email', true, '{"nodes": [], "connections": {}}'),
  ('Slack Notification Bot', 'Post formatted notifications to Slack channels based on webhook triggers.', 'Communication', true, '{"nodes": [], "connections": {}}'),
  ('Lead Capture Form', 'Capture leads from a web form and add them to your CRM automatically.', 'Sales', true, '{"nodes": [], "connections": {}}'),
  ('Daily Report Generator', 'Generate and email a daily summary report from your database.', 'Reporting', true, '{"nodes": [], "connections": {}}'),
  ('Invoice Automation', 'Create and send invoices automatically when a project milestone is completed.', 'Finance', true, '{"nodes": [], "connections": {}}')
ON CONFLICT DO NOTHING;
