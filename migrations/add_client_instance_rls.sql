-- Allow clients to read their own instance assignments
-- Without this policy, the client-side Supabase query in usePortalInstances
-- returns empty results for clients (team_id check only matches the agency).
CREATE POLICY IF NOT EXISTS "Client can view own instance assignments" ON client_instances FOR SELECT
  USING (user_id = auth.uid());
