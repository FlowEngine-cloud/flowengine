-- API Key table (single key per user)
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS api_key (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_hash ON api_key(key_hash);

-- Enable RLS
ALTER TABLE api_key ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api key" ON api_key
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api key" ON api_key
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api key" ON api_key
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api key" ON api_key
  FOR DELETE USING (auth.uid() = user_id);
