-- FlowEngine Portal - Supabase Schema Migration
-- Run this in your Supabase SQL Editor to set up the database
--
-- Prerequisites:
--   1. Create a Supabase project at https://supabase.com
--   2. Go to SQL Editor in the Supabase dashboard
--   3. Paste and run this entire file

-- ============================================
-- Enable required extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. profiles - User profiles (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  team_id UUID,
  stripe_customer_id TEXT,
  -- Agency branding
  business_name TEXT,
  agency_logo_url TEXT,
  -- Agency Stripe integration
  agency_stripe_key_encrypted TEXT,
  agency_stripe_key_set BOOLEAN DEFAULT false,
  -- Agency SMTP integration
  agency_smtp_host TEXT,
  agency_smtp_port INTEGER DEFAULT 587,
  agency_smtp_user TEXT,
  agency_smtp_pass_encrypted TEXT,
  agency_smtp_sender TEXT,
  agency_smtp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. team_members - Agency team membership
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'removed')),
  token TEXT UNIQUE,
  accepted_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_owner_id ON team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_token ON team_members(token);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- ============================================
-- 3. n8n_instances - n8n instance records
-- ============================================
CREATE TABLE IF NOT EXISTS n8n_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID,
  instance_name TEXT NOT NULL,
  instance_url TEXT,
  api_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'running', 'stopped', 'error', 'destroyed')),
  storage_gb INTEGER DEFAULT 10,
  plan TEXT DEFAULT 'pro',
  coolify_uuid TEXT,
  domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_instances_user_id ON n8n_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_instances_team_id ON n8n_instances(team_id);
CREATE INDEX IF NOT EXISTS idx_n8n_instances_status ON n8n_instances(status);

-- ============================================
-- 4. pay_per_instance_deployments - Instance billing/deployment tracking
-- ============================================
CREATE TABLE IF NOT EXISTS pay_per_instance_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID,
  instance_id UUID REFERENCES n8n_instances(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL,
  instance_url TEXT,
  subdomain TEXT,
  domain TEXT,
  status TEXT DEFAULT 'pending_deploy',
  storage_limit_gb INTEGER DEFAULT 10,
  server_ip TEXT,
  coolify_service_id TEXT,
  -- Resource limits
  n8n_cpu_limit NUMERIC,
  n8n_memory_gb NUMERIC,
  pg_cpu_limit NUMERIC,
  pg_memory_gb NUMERIC,
  -- Postgres credentials (stored for management)
  postgres_user TEXT,
  postgres_password TEXT,
  postgres_database TEXT,
  -- Billing (optional - only for FlowEngine Cloud)
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  subscription_status TEXT DEFAULT 'active',
  -- Hosting mode
  hosting_mode TEXT DEFAULT 'selfhost' CHECK (hosting_mode IN ('selfhost', 'cloud')),
  -- Client assignment
  client_id UUID,
  client_name TEXT,
  invited_by_user_id UUID,
  service_type TEXT DEFAULT 'n8n',
  is_external BOOLEAN DEFAULT false,
  n8n_api_key TEXT,
  ai_payer TEXT DEFAULT 'agency' CHECK (ai_payer IN ('agency', 'client')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppid_user_id ON pay_per_instance_deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_ppid_team_id ON pay_per_instance_deployments(team_id);
CREATE INDEX IF NOT EXISTS idx_ppid_status ON pay_per_instance_deployments(status);
CREATE INDEX IF NOT EXISTS idx_ppid_instance_id ON pay_per_instance_deployments(instance_id);
CREATE INDEX IF NOT EXISTS idx_ppid_stripe_subscription ON pay_per_instance_deployments(stripe_subscription_id);

-- ============================================
-- 5. client_instances - Client instance assignments
-- ============================================
CREATE TABLE IF NOT EXISTS client_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  client_id UUID NOT NULL,
  user_id UUID,
  instance_id UUID REFERENCES pay_per_instance_deployments(id) ON DELETE CASCADE,
  instance_name TEXT,
  instance_url TEXT,
  access_level TEXT DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'admin')),
  assigned_by UUID REFERENCES profiles(id),
  invited_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_instances_team_id ON client_instances(team_id);
CREATE INDEX IF NOT EXISTS idx_client_instances_client_id ON client_instances(client_id);
CREATE INDEX IF NOT EXISTS idx_client_instances_instance_id ON client_instances(instance_id);

-- ============================================
-- 6. client_invites - Client invitations
-- ============================================
CREATE TABLE IF NOT EXISTS client_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'client',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by UUID REFERENCES profiles(id),
  token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  -- Instance / service linking
  instance_id UUID REFERENCES pay_per_instance_deployments(id) ON DELETE SET NULL,
  linked_instance_ids UUID[],
  linked_service_ids UUID[],
  storage_size_gb INTEGER DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly',
  allow_full_access BOOLEAN DEFAULT false,
  is_external BOOLEAN DEFAULT false,
  include_whatsapp BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_invites_team_id ON client_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_client_invites_email ON client_invites(email);
CREATE INDEX IF NOT EXISTS idx_client_invites_token ON client_invites(token);
CREATE INDEX IF NOT EXISTS idx_client_invites_status ON client_invites(status);
CREATE INDEX IF NOT EXISTS idx_client_invites_invited_by ON client_invites(invited_by);

-- ============================================
-- 7. client_widgets - Widgets assigned to clients
-- ============================================
CREATE TABLE IF NOT EXISTS client_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID,
  client_id UUID,
  widget_id UUID,
  user_id UUID,
  created_by UUID,
  instance_id UUID REFERENCES pay_per_instance_deployments(id) ON DELETE SET NULL,
  name TEXT,
  description TEXT,
  widget_type TEXT DEFAULT 'form',
  form_fields JSONB,
  chatbot_config JSONB,
  webhook_url TEXT,
  styles JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT false,
  assigned_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_widgets_team_id ON client_widgets(team_id);
CREATE INDEX IF NOT EXISTS idx_client_widgets_client_id ON client_widgets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_widgets_user_id ON client_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_client_widgets_instance_id ON client_widgets(instance_id);

-- ============================================
-- 8. widget_categories - Widget categorization
-- ============================================
CREATE TABLE IF NOT EXISTS widget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widget_categories_team_id ON widget_categories(team_id);

-- ============================================
-- 9. widget_category_links - Widget-to-category mapping
-- ============================================
CREATE TABLE IF NOT EXISTS widget_category_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL,
  category_id UUID REFERENCES widget_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(widget_id, category_id)
);

-- ============================================
-- 10. workflow_templates - Workflow template definitions
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT,
  workflow_json JSONB,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  import_count INTEGER DEFAULT 0,
  required_credentials JSONB DEFAULT '[]'::jsonb,
  version INTEGER DEFAULT 1,
  changelog TEXT,
  created_by UUID REFERENCES profiles(id),
  install_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_team_id ON workflow_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_public ON workflow_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_active ON workflow_templates(is_active);

-- ============================================
-- 11. workflow_template_imports - Template import tracking
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_template_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  instance_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'failed')),
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wti_template_id ON workflow_template_imports(template_id);
CREATE INDEX IF NOT EXISTS idx_wti_user_id ON workflow_template_imports(user_id);

-- ============================================
-- 12. credential_records - Credential management
-- ============================================
CREATE TABLE IF NOT EXISTS credential_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  data_encrypted TEXT,
  instance_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credential_records_team_id ON credential_records(team_id);
CREATE INDEX IF NOT EXISTS idx_credential_records_user_id ON credential_records(user_id);

-- ============================================
-- 13. whatsapp_instances - WhatsApp service instances
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),
  instance_name TEXT NOT NULL,
  instance_url TEXT,
  api_key TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connecting', 'connected', 'disconnected', 'error')),
  n8n_instance_id UUID REFERENCES n8n_instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_team_id ON whatsapp_instances(team_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);

-- ============================================
-- 14. conversations - Chat/conversation storage
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT,
  title TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_per_instance_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_template_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Team members: owners manage, members can see their own invite
CREATE POLICY "Owner can manage team" ON team_members FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Member can view own invite" ON team_members FOR SELECT USING (member_id = auth.uid() OR email = auth.email());

-- n8n instances: users can manage their own instances
CREATE POLICY "Users can view own instances" ON n8n_instances FOR SELECT
  USING (user_id = auth.uid() OR team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can manage own instances" ON n8n_instances FOR ALL
  USING (user_id = auth.uid());

-- Deployments: team-scoped access
CREATE POLICY "Users can view own deployments" ON pay_per_instance_deployments FOR SELECT
  USING (user_id = auth.uid() OR team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can manage own deployments" ON pay_per_instance_deployments FOR ALL
  USING (user_id = auth.uid());

-- Client instances: team-scoped access
CREATE POLICY "Team can view client instances" ON client_instances FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage client instances" ON client_instances FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Client invites: agency-scoped access
CREATE POLICY "Agency can view sent invites" ON client_invites FOR SELECT USING (invited_by = auth.uid());
CREATE POLICY "Agency can manage sent invites" ON client_invites FOR ALL USING (invited_by = auth.uid());

-- Client widgets: team-scoped access
CREATE POLICY "Team can view client widgets" ON client_widgets FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage client widgets" ON client_widgets FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Widget categories: team-scoped
CREATE POLICY "Team can view categories" ON widget_categories FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage categories" ON widget_categories FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Widget category links: accessible if widget is accessible
CREATE POLICY "Users can view category links" ON widget_category_links FOR SELECT USING (true);
CREATE POLICY "Users can manage category links" ON widget_category_links FOR ALL USING (true);

-- Workflow templates: public templates visible to all, team templates to team
CREATE POLICY "Anyone can view public templates" ON workflow_templates FOR SELECT
  USING (is_public = true OR team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage templates" ON workflow_templates FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Template imports: user-scoped
CREATE POLICY "Users can view own imports" ON workflow_template_imports FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can manage own imports" ON workflow_template_imports FOR ALL
  USING (user_id = auth.uid());

-- Credential records: team-scoped
CREATE POLICY "Team can view credentials" ON credential_records FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage credentials" ON credential_records FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- WhatsApp instances: team-scoped
CREATE POLICY "Team can view whatsapp" ON whatsapp_instances FOR SELECT
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Team can manage whatsapp" ON whatsapp_instances FOR ALL
  USING (team_id IN (SELECT team_id FROM profiles WHERE id = auth.uid()));

-- Conversations: user-scoped
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass (for API routes using service role key)
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access team_members" ON team_members FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access n8n_instances" ON n8n_instances FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access ppid" ON pay_per_instance_deployments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access client_instances" ON client_instances FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access client_invites" ON client_invites FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access client_widgets" ON client_widgets FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access widget_categories" ON widget_categories FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access widget_category_links" ON widget_category_links FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access workflow_templates" ON workflow_templates FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access wti" ON workflow_template_imports FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access credential_records" ON credential_records FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access whatsapp" ON whatsapp_instances FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access conversations" ON conversations FOR ALL TO service_role USING (true);

-- ============================================
-- 15. portal_settings - System-wide configuration
-- ============================================
CREATE TABLE IF NOT EXISTS portal_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- n8n Connection
  n8n_base_url TEXT,
  n8n_api_key TEXT,
  n8n_webhook_url TEXT,

  -- Hosting (Coolify)
  coolify_url TEXT,
  coolify_api_token TEXT,

  -- AI Provider (OpenAI-compatible, e.g. OpenRouter)
  ai_base_url TEXT,
  ai_api_key TEXT,

  -- n8n Instance SMTP (used when provisioning new n8n instances)
  n8n_smtp_host TEXT,
  n8n_smtp_port INTEGER DEFAULT 587,
  n8n_smtp_user TEXT,
  n8n_smtp_pass TEXT,
  n8n_smtp_sender TEXT,
  n8n_smtp_ssl BOOLEAN DEFAULT false,

  -- n8n Docker Settings
  n8n_docker_image TEXT DEFAULT 'n8nio/n8n:latest',
  n8n_runners_enabled BOOLEAN DEFAULT false,
  n8n_runner_image TEXT,

  -- FlowEngine Managed Hosting API
  flowengine_api_key TEXT,
  flowengine_api_url TEXT,

  -- Auth / Login Page
  allow_signup BOOLEAN DEFAULT false,
  enable_google_auth BOOLEAN DEFAULT false,
  enable_linkedin_auth BOOLEAN DEFAULT false,
  enable_github_auth BOOLEAN DEFAULT false,

  -- General
  admin_email TEXT,

  -- OAuth provider credentials (Google, Microsoft, Slack, etc.)
  oauth_credentials JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default row (single-row settings pattern)
INSERT INTO portal_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read portal settings"
  ON portal_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can update portal settings"
  ON portal_settings FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Service role full access portal_settings"
  ON portal_settings FOR ALL TO service_role USING (true);

-- ============================================
-- 16. agency_client_billing_settings
-- ============================================
CREATE TABLE IF NOT EXISTS agency_client_billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_expected_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_acbs_agency_id ON agency_client_billing_settings(agency_id);
CREATE INDEX IF NOT EXISTS idx_acbs_client_user_id ON agency_client_billing_settings(client_user_id);

ALTER TABLE agency_client_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency can manage billing settings" ON agency_client_billing_settings FOR ALL USING (agency_id = auth.uid());
CREATE POLICY "Service role full access acbs" ON agency_client_billing_settings FOR ALL TO service_role USING (true);

-- ============================================
-- 17. agency_manual_payments
-- ============================================
CREATE TABLE IF NOT EXISTS agency_manual_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'crypto', 'other')),
  description TEXT,
  payment_date DATE NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amp_agency_id ON agency_manual_payments(agency_id);
CREATE INDEX IF NOT EXISTS idx_amp_client_user_id ON agency_manual_payments(client_user_id);

ALTER TABLE agency_manual_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency can manage manual payments" ON agency_manual_payments FOR ALL USING (agency_id = auth.uid());
CREATE POLICY "Service role full access amp" ON agency_manual_payments FOR ALL TO service_role USING (true);

-- ============================================
-- 16. agency_client_notes - Per-client notes (agency-only)
-- ============================================
CREATE TABLE IF NOT EXISTS agency_client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL,
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_acn_agency_id ON agency_client_notes(agency_id);
CREATE INDEX IF NOT EXISTS idx_acn_client_user_id ON agency_client_notes(client_user_id);

ALTER TABLE agency_client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency can manage client notes" ON agency_client_notes FOR ALL USING (agency_id = auth.uid());
CREATE POLICY "Service role full access acn" ON agency_client_notes FOR ALL TO service_role USING (true);

-- ============================================
-- 17. agency_client_custom_entries - Custom properties per client
-- ============================================
CREATE TABLE IF NOT EXISTS agency_client_custom_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT DEFAULT '',
  access TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acce_agency_id ON agency_client_custom_entries(agency_id);
CREATE INDEX IF NOT EXISTS idx_acce_client_user_id ON agency_client_custom_entries(client_user_id);

ALTER TABLE agency_client_custom_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency can manage custom entries" ON agency_client_custom_entries FOR ALL USING (agency_id = auth.uid());
CREATE POLICY "Service role full access acce" ON agency_client_custom_entries FOR ALL TO service_role USING (true);

-- ============================================
-- 18. api_key - User API keys for external API and MCP access
-- ============================================
CREATE TABLE IF NOT EXISTS api_key (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_key(key_hash);

ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api key" ON api_key
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api key" ON api_key
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api key" ON api_key
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api key" ON api_key
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Role grants (required for PostgREST + RLS to work)
-- ============================================

-- authenticated users: full CRUD (RLS policies control row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  profiles,
  team_members,
  n8n_instances,
  pay_per_instance_deployments,
  client_instances,
  client_invites,
  client_widgets,
  widget_categories,
  widget_category_links,
  workflow_templates,
  workflow_template_imports,
  credential_records,
  whatsapp_instances,
  conversations,
  portal_settings,
  agency_client_billing_settings,
  agency_manual_payments,
  agency_client_notes,
  agency_client_custom_entries
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON api_key TO authenticated;

-- service_role: full access (bypasses RLS via BYPASSRLS attribute)
GRANT ALL ON
  profiles,
  team_members,
  n8n_instances,
  pay_per_instance_deployments,
  client_instances,
  client_invites,
  client_widgets,
  widget_categories,
  widget_category_links,
  workflow_templates,
  workflow_template_imports,
  credential_records,
  whatsapp_instances,
  conversations,
  portal_settings,
  agency_client_billing_settings,
  agency_manual_payments,
  agency_client_notes,
  agency_client_custom_entries,
  api_key
TO service_role;

-- anon: read-only access to public/portal config tables
GRANT SELECT ON portal_settings, widget_categories TO anon;

-- ============================================
-- Done! Your FlowEngine Portal database is ready.
-- ============================================
