/**
 * Creates the demo user for read-only demo mode.
 * Run this on the server where the portal is deployed:
 *
 *   node scripts/create-demo-user.mjs
 *
 * Requires these env vars to be set (they are in your .env):
 *   SUPABASE_URL  or  SITE_URL
 *   SERVICE_ROLE_KEY
 */

const supabaseUrl = process.env.SUPABASE_URL || `http://kong:8000`;
const serviceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEMO_EMAIL    = process.env.NEXT_PUBLIC_DEMO_EMAIL    || 'demo@example.com';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

if (!DEMO_PASSWORD) {
  console.error('❌  NEXT_PUBLIC_DEMO_PASSWORD not set');
  console.error('    Set it in your .env or pass it inline:');
  console.error('    NEXT_PUBLIC_DEMO_PASSWORD=yourpassword node scripts/create-demo-user.mjs');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌  SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  }),
});

const data = await res.json();

if (res.ok) {
  console.log(`✅  Demo user created: ${DEMO_EMAIL}`);
  console.log(`    Password: ${DEMO_PASSWORD}`);
  console.log(`\nSet these env vars in Coolify:`);
  console.log(`  DEMO_MODE=true`);
  console.log(`  NEXT_PUBLIC_DEMO_MODE=true`);
  console.log(`  NEXT_PUBLIC_DEMO_EMAIL=${DEMO_EMAIL}`);
  console.log(`  NEXT_PUBLIC_DEMO_PASSWORD=${DEMO_PASSWORD}`);
} else if (data.msg?.includes('already') || data.message?.includes('already') || res.status === 422) {
  console.log(`ℹ️   User already exists: ${DEMO_EMAIL}`);
} else {
  console.error('❌  Failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}
