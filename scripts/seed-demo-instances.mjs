/**
 * Seeds demo instances for the demo user (and optional demo client user).
 * Run after create-demo-user.mjs:
 *
 *   node scripts/seed-demo-instances.mjs
 *
 * Requires:
 *   SUPABASE_URL                      (or defaults to http://kong:8000)
 *   SERVICE_ROLE_KEY                  (or SUPABASE_SERVICE_ROLE_KEY)
 *   NEXT_PUBLIC_DEMO_EMAIL
 *
 * Optional (enables "View as client →" banner link):
 *   NEXT_PUBLIC_DEMO_CLIENT_EMAIL
 *   NEXT_PUBLIC_DEMO_CLIENT_PASSWORD
 */

const supabaseUrl    = process.env.SUPABASE_URL || 'http://kong:8000';
const serviceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail      = process.env.NEXT_PUBLIC_DEMO_EMAIL || 'demo@flowengine.cloud';

if (!serviceRoleKey) {
  console.error('❌  SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const headers = {
  apikey:         serviceRoleKey,
  Authorization:  `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer:         'return=representation',
};

async function rest(method, path, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function isDuplicate(data) {
  const s = JSON.stringify(data);
  return s.includes('duplicate') || s.includes('unique');
}

// ── 1. Look up the demo user ──────────────────────────────────────────────────
const usersRes  = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(demoEmail)}`, { headers });
const usersData = await usersRes.json();
const demoUser  = usersData?.users?.[0];
if (!demoUser) {
  console.error(`❌  Demo user not found: ${demoEmail}`);
  console.error('    Run create-demo-user.mjs first.');
  process.exit(1);
}
const userId = demoUser.id;
console.log(`✅  Found demo user: ${demoEmail} (${userId})`);

// ── 2. Upsert n8n instance (with fake API key so portal shows as connected) ───
// First check if it already exists so we can capture the ID either way.
const existingRes = await rest('GET',
  `pay_per_instance_deployments?user_id=eq.${userId}&instance_name=eq.My%20n8n%20Automation&select=id`
);
let n8nInstanceId = existingRes.data?.[0]?.id;

if (n8nInstanceId) {
  // Patch the existing record to set the fake API key
  const patchRes = await rest('PATCH',
    `pay_per_instance_deployments?id=eq.${n8nInstanceId}`,
    { n8n_api_key: 'demo-key' }
  );
  if (patchRes.ok) {
    console.log('✅  n8n demo instance updated (api key set)');
  } else {
    console.error('❌  Failed to patch n8n instance:', JSON.stringify(patchRes.data));
  }
} else {
  const createRes = await rest('POST', 'pay_per_instance_deployments', {
    user_id:             userId,
    team_id:             userId,
    instance_name:       'My n8n Automation',
    instance_url:        'https://n8n.demo.flowengine.cloud',
    status:              'running',
    service_type:        'n8n',
    is_external:         true,
    hosting_mode:        'cloud',
    subscription_status: 'active',
    storage_limit_gb:    10,
    n8n_api_key:         'demo-key',
  });
  if (createRes.ok) {
    n8nInstanceId = Array.isArray(createRes.data) ? createRes.data[0]?.id : createRes.data?.id;
    console.log('✅  n8n demo instance created');
  } else if (isDuplicate(createRes.data)) {
    // Race condition — fetch it now
    const retryRes = await rest('GET',
      `pay_per_instance_deployments?user_id=eq.${userId}&instance_name=eq.My%20n8n%20Automation&select=id`
    );
    n8nInstanceId = retryRes.data?.[0]?.id;
    console.log('ℹ️   n8n demo instance already exists');
  } else {
    console.error('❌  Failed to create n8n instance:', JSON.stringify(createRes.data));
  }
}

if (!n8nInstanceId) {
  console.error('❌  Could not determine n8n instance ID — skipping widgets');
} else {
  console.log(`     Instance ID: ${n8nInstanceId}`);

  // ── 3. Seed demo client_widgets ─────────────────────────────────────────────
  const widgets = [
    {
      user_id:      userId,
      team_id:      userId,
      created_by:   userId,
      instance_id:  n8nInstanceId,
      name:         'Lead Capture Form',
      widget_type:  'form',
      webhook_url:  'https://n8n.demo.flowengine.cloud/webhook/lead-capture',
      form_fields:  [
        { name: 'name',    type: 'text',  required: true  },
        { name: 'email',   type: 'email', required: true  },
        { name: 'company', type: 'text',  required: false },
      ],
      is_active:    true,
    },
    {
      user_id:      userId,
      team_id:      userId,
      created_by:   userId,
      instance_id:  n8nInstanceId,
      name:         'Support Chatbot',
      widget_type:  'chatbot',
      webhook_url:  'https://n8n.demo.flowengine.cloud/webhook/support-chat',
      form_fields:  [],
      chatbot_config: { greeting: 'Hi! How can I help you today?' },
      is_active:    true,
    },
    {
      user_id:      userId,
      team_id:      userId,
      created_by:   userId,
      instance_id:  n8nInstanceId,
      name:         'Sync Trigger',
      widget_type:  'button',
      webhook_url:  'https://n8n.demo.flowengine.cloud/webhook/sync-trigger',
      form_fields:  [],
      is_active:    true,
    },
  ];

  let widgetCount = 0;
  for (const w of widgets) {
    // Skip if widget with this name already exists for this instance
    const existW = await rest('GET',
      `client_widgets?instance_id=eq.${n8nInstanceId}&name=eq.${encodeURIComponent(w.name)}&select=id`
    );
    if (existW.data?.[0]?.id) {
      widgetCount++;
      continue;
    }
    const wRes = await rest('POST', 'client_widgets', w);
    if (wRes.ok) {
      widgetCount++;
    } else if (isDuplicate(wRes.data)) {
      widgetCount++;
    } else {
      console.error(`❌  Failed to create widget "${w.name}":`, JSON.stringify(wRes.data));
    }
  }
  console.log(`✅  ${widgetCount}/3 demo widgets ready`);
}

// ── 4. Seed workflow templates ────────────────────────────────────────────────
const minimalWorkflow = { nodes: [], connections: {}, settings: {} };

const templates = [
  {
    team_id:              userId,
    created_by:           userId,
    name:                 'Lead Qualification Agent',
    description:          'Automatically qualify leads with AI and push to HubSpot',
    category:             'Sales',
    icon:                 'zap',
    workflow_json:        minimalWorkflow,
    required_credentials: [
      { type: 'openAiApi',      name: 'OpenAI',   icon: 'openai'   },
      { type: 'hubspotOAuth2',  name: 'HubSpot',  icon: 'hubspot'  },
    ],
    is_active:       true,
    import_count:    12,
    version:         2,
  },
  {
    team_id:              userId,
    created_by:           userId,
    name:                 'Customer Support Bot',
    description:          'AI-powered support bot with Slack notifications',
    category:             'Support',
    icon:                 'message-square',
    workflow_json:        minimalWorkflow,
    required_credentials: [
      { type: 'CUSTOM.flowEngineLlm', name: 'FlowEngine AI', icon: 'openai' },
      { type: 'slackOAuth2',          name: 'Slack',         icon: 'slack'  },
    ],
    is_active:       true,
    import_count:    8,
    version:         1,
  },
  {
    team_id:              userId,
    created_by:           userId,
    name:                 'Google Sheets Data Sync',
    description:          'Sync data between sources and Google Sheets automatically',
    category:             'Data Management',
    icon:                 'table',
    workflow_json:        minimalWorkflow,
    required_credentials: [
      { type: 'googleSheetsOAuth2', name: 'Google Sheets', icon: 'sheets' },
      { type: 'googleOAuth2',       name: 'Google',        icon: 'google' },
    ],
    is_active:       true,
    import_count:    0,
    version:         1,
  },
];

let tplCount = 0;
for (const t of templates) {
  const existT = await rest('GET',
    `workflow_templates?team_id=eq.${userId}&name=eq.${encodeURIComponent(t.name)}&select=id`
  );
  if (existT.data?.[0]?.id) {
    tplCount++;
    continue;
  }
  const tRes = await rest('POST', 'workflow_templates', t);
  if (tRes.ok) {
    tplCount++;
  } else if (isDuplicate(tRes.data)) {
    tplCount++;
  } else {
    console.error(`❌  Failed to create template "${t.name}":`, JSON.stringify(tRes.data));
  }
}
console.log(`✅  ${tplCount}/3 workflow templates ready`);

// ── 5. Seed WhatsApp instance ─────────────────────────────────────────────────
const existWa = await rest('GET',
  `whatsapp_instances?user_id=eq.${userId}&instance_name=eq.demo-whatsapp&select=id`
);
if (existWa.data?.[0]?.id) {
  console.log('ℹ️   WhatsApp demo instance already exists');
} else {
  const waRes = await rest('POST', 'whatsapp_instances', {
    user_id:       userId,
    team_id:       userId,
    instance_name: 'demo-whatsapp',
    display_name:  'Demo WhatsApp',
    instance_url:  'https://whatsapp.demo.flowengine.cloud',
    phone_number:  '+1 555 123 4567',
    status:        'connected',
  });
  if (waRes.ok) {
    console.log('✅  WhatsApp demo instance created');
  } else if (isDuplicate(waRes.data)) {
    console.log('ℹ️   WhatsApp demo instance already exists');
  } else {
    console.error('❌  Failed to create WhatsApp instance:', JSON.stringify(waRes.data));
  }
}

// ── 6. Seed dummy client (Acme Corp) ─────────────────────────────────────────
const existClient = await rest('GET',
  `client_invites?invited_by=eq.${userId}&name=eq.Acme%20Corp&select=id`
);
if (existClient.data?.[0]?.id) {
  console.log('ℹ️   Demo client already exists');
} else {
  const token = `ci_demo_${userId.replace(/-/g, '').slice(0, 16)}`;
  const clientRes = await rest('POST', 'client_invites', {
    token,
    email:            `noemail-acme@portal.local`,
    name:             'Acme Corp',
    invited_by:       userId,
    status:           'accepted',
    accepted_at:      new Date().toISOString(),
    accepted_by:      null,
    storage_size_gb:  0,
    billing_cycle:    'monthly',
    allow_full_access: false,
    is_external:      true,
    include_whatsapp: false,
    expires_at:       new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (clientRes.ok) {
    console.log('✅  Demo client (Acme Corp) created');
  } else if (isDuplicate(clientRes.data)) {
    console.log('ℹ️   Demo client already exists');
  } else {
    console.error('❌  Failed to create demo client:', JSON.stringify(clientRes.data));
  }
}

// ── 7. Create/find demo client user and link to n8n instance ─────────────────
const clientEmail    = process.env.NEXT_PUBLIC_DEMO_CLIENT_EMAIL;
const clientPassword = process.env.NEXT_PUBLIC_DEMO_CLIENT_PASSWORD;

let clientUserId = null;

if (!clientEmail || !clientPassword) {
  console.log('ℹ️   NEXT_PUBLIC_DEMO_CLIENT_EMAIL / _PASSWORD not set — skipping client user setup');
  console.log('    Set these to enable the "View as client →" banner link.');
} else if (!n8nInstanceId) {
  console.log('ℹ️   No n8n instance — skipping client user setup');
} else {
  // Find or create the client auth user
  const findClientRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(clientEmail)}`,
    { headers }
  );
  const findClientData = await findClientRes.json();
  const existingClientUser = findClientData?.users?.[0];

  if (existingClientUser) {
    clientUserId = existingClientUser.id;
    console.log(`✅  Found client user: ${clientEmail} (${clientUserId})`);
  } else {
    const createClientRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: clientEmail, password: clientPassword, email_confirm: true }),
    });
    const createClientData = await createClientRes.json();
    if (createClientRes.ok) {
      clientUserId = createClientData.id;
      console.log(`✅  Client user created: ${clientEmail}`);
    } else if (JSON.stringify(createClientData).includes('already')) {
      const refetch = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(clientEmail)}`,
        { headers }
      );
      clientUserId = (await refetch.json())?.users?.[0]?.id;
      console.log(`ℹ️   Client user already exists: ${clientEmail}`);
    } else {
      console.error('❌  Failed to create client user:', JSON.stringify(createClientData));
    }
  }

  if (clientUserId) {
    // Link client user to n8n instance via client_instances
    const existCI = await rest('GET',
      `client_instances?instance_id=eq.${n8nInstanceId}&user_id=eq.${clientUserId}&select=id`
    );
    if (existCI.data?.[0]?.id) {
      console.log('ℹ️   Client already linked to n8n instance');
    } else {
      const ciRes = await rest('POST', 'client_instances', {
        instance_id: n8nInstanceId,
        user_id:     clientUserId,
        invited_by:  userId,
      });
      if (ciRes.ok) {
        console.log('✅  Client linked to n8n instance');
      } else if (isDuplicate(ciRes.data)) {
        console.log('ℹ️   Client already linked to n8n instance');
      } else {
        console.error('❌  Failed to link client to instance:', JSON.stringify(ciRes.data));
      }
    }

    // Update Acme Corp invite to reference the real client user
    await rest('PATCH',
      `client_invites?invited_by=eq.${userId}&name=eq.Acme%20Corp`,
      { accepted_by: clientUserId, email: clientEmail }
    );
    console.log('✅  Acme Corp invite linked to client user');
  }
}

// ── 8. Set agency branding (demo logo + business name) ───────────────────────
const brandingRes = await rest('PATCH', `profiles?id=eq.${userId}`, {
  agency_logo_url: '/demo-logo.svg',
  business_name:   'Demo Agency',
});
if (brandingRes.ok) {
  console.log('✅  Agency branding set (logo + business name)');
} else {
  console.warn('⚠️   Could not set agency branding:', JSON.stringify(brandingRes.data));
}

console.log('\nDone! Demo user now has:');
console.log('  • 1 n8n instance  → "My n8n Automation" (running, api key set)');
console.log('  • 3 client widgets → Lead Capture Form, Support Chatbot, Sync Trigger');
console.log('  • 3 workflow templates → Lead Qual, Support Bot, Sheets Sync');
console.log('  • 1 WhatsApp      → demo-whatsapp (+1 555 123 4567, connected)');
console.log('  • 1 client        → Acme Corp (linked to n8n instance)');
if (clientUserId) {
  console.log(`  • 1 client user   → ${clientEmail} (can log in, sees n8n instance)`);
}
