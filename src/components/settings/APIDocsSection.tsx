'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';

// ─── Primitives ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded text-xs font-medium transition-colors border border-gray-700 flex-shrink-0"
    >
      {copied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></> : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/80">
        <span className="text-gray-600 text-xs font-mono">{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const map: Record<string, string> = {
    GET:    'bg-blue-900/30  text-blue-400  border-blue-700/40',
    POST:   'bg-green-900/30 text-green-400 border-green-700/40',
    PUT:    'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
    DELETE: 'bg-red-900/30   text-red-400   border-red-700/40',
    PATCH:  'bg-purple-900/30 text-purple-400 border-purple-700/40',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${map[method] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {method}
    </span>
  );
}

// ─── Endpoint data ───────────────────────────────────────────────────────────

interface EP {
  method: string;
  path: string;
  description: string;
  params?: { name: string; in: 'query' | 'body'; type: string; required?: boolean; description: string }[];
  example: (base: string) => string;
  response: string;
}

function buildEndpoints(base: string): EP[] {
  return [
    // ── User / Auth ──────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/v1/me',
      description: 'Returns the authenticated user\'s profile.',
      example: (b) => `curl ${b}/api/v1/me \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "data": {\n    "id": "uuid",\n    "full_name": "Jane Smith",\n    "email": "jane@example.com",\n    "business_name": "Acme Corp",\n    "created_at": "2025-01-15T10:00:00Z"\n  }\n}`,
    },
    // ── Instances ────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/v1/instances',
      description: 'Lists all n8n instances belonging to the authenticated user.',
      example: (b) => `curl ${b}/api/v1/instances \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "data": [\n    {\n      "id": "uuid",\n      "instance_name": "my-n8n",\n      "instance_url": "https://my-n8n.example.com",\n      "status": "running",\n      "created_at": "2025-01-20T09:00:00Z"\n    }\n  ]\n}`,
    },
    // ── MCP: portals ─────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/mcp/portals',
      description: 'Lists portal deployments. Used by the FlowEngine MCP server.',
      example: (b) => `curl ${b}/api/mcp/portals \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "portals": [\n    {\n      "id": "uuid",\n      "instance_name": "my-portal",\n      "instance_url": "https://portal.example.com",\n      "status": "running"\n    }\n  ]\n}`,
    },
    // ── MCP: instances ───────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/mcp/instances',
      description: 'Lists all instances with domain and storage info.',
      example: (b) => `curl ${b}/api/mcp/instances \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "instances": [\n    {\n      "id": "uuid",\n      "instance_name": "n8n-prod",\n      "instance_url": "https://n8n.example.com",\n      "status": "running",\n      "domain": "n8n.example.com",\n      "storage_gb": 5\n    }\n  ]\n}`,
    },
    // ── MCP: workflows ───────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/mcp/workflows',
      description: 'Lists workflow templates. Optionally filter by instance.',
      params: [
        { name: 'instanceId', in: 'query', type: 'string', description: 'Filter workflows for a specific instance ID.' },
      ],
      example: (b) => `curl "${b}/api/mcp/workflows?instanceId=uuid" \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "workflows": [\n    {\n      "id": "uuid",\n      "name": "Lead Nurture",\n      "description": "Automated lead follow-up sequence",\n      "instance_id": "uuid"\n    }\n  ]\n}`,
    },
    // ── MCP: components ──────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/mcp/components',
      description: 'Lists UI components (widgets, chatbots). Optionally filter by instance.',
      params: [
        { name: 'instanceId', in: 'query', type: 'string', description: 'Filter components for a specific instance ID.' },
      ],
      example: (b) => `curl "${b}/api/mcp/components?instanceId=uuid" \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "components": [\n    {\n      "id": "uuid",\n      "name": "Support Chat",\n      "type": "chatbot",\n      "instance_id": "uuid"\n    }\n  ]\n}`,
    },
    // ── MCP: clients ─────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/mcp/clients',
      description: 'Lists clients invited by the authenticated agency user, with their assigned instances.',
      example: (b) => `curl ${b}/api/mcp/clients \\\n  -H "Authorization: Bearer fp_your_key"`,
      response: `{\n  "success": true,\n  "clients": [\n    {\n      "id": "uuid",\n      "email": "client@example.com",\n      "name": "Acme Inc",\n      "status": "accepted",\n      "instance_count": 2,\n      "instances": [\n        { "id": "uuid", "instance_name": "acme-n8n", "status": "running" }\n      ]\n    }\n  ]\n}`,
    },
    // ── AI payer ─────────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/api/n8n/update-ai-payer',
      description: 'Sets whether the agency or the client pays for AI usage on a specific instance. Requires FlowEngine API to be connected.',
      params: [
        { name: 'instanceId', in: 'body', type: 'string', required: true, description: 'UUID of the instance to update.' },
        { name: 'aiPayer', in: 'body', type: '"agency" | "client"', required: true, description: 'Who pays for AI calls.' },
      ],
      example: (b) => `curl -X POST ${b}/api/n8n/update-ai-payer \\\n  -H "Authorization: Bearer <session-token>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"instanceId":"uuid","aiPayer":"client"}'`,
      response: `{\n  "success": true,\n  "instanceId": "uuid",\n  "aiPayer": "client"\n}`,
    },
    // ── Client budget ────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/api/client/budget',
      description: 'Returns AI token budget for a client. Proxies to FlowEngine Cloud when an API key is configured; otherwise returns feConnected: false.',
      params: [
        { name: 'clientUserId', in: 'query', type: 'string', description: 'View budget for this client user ID. Defaults to the authenticated user.' },
      ],
      example: (b) => `curl "${b}/api/client/budget?clientUserId=uuid" \\\n  -H "Authorization: Bearer <session-token>"`,
      response: `{\n  "success": true,\n  "feConnected": true,\n  "budget": {\n    "tokensRemaining": 150000,\n    "tokensUsed": 50000\n  }\n}`,
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function APIDocsSection() {
  const [baseUrl, setBaseUrl] = useState('https://your-portal-url');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  const endpoints = buildEndpoints(baseUrl);

  // Group by category
  const categories = [
    { label: 'User', paths: ['/api/v1/me'] },
    { label: 'Instances', paths: ['/api/v1/instances'] },
    { label: 'MCP', paths: ['/api/mcp/portals', '/api/mcp/instances', '/api/mcp/workflows', '/api/mcp/components', '/api/mcp/clients'] },
    { label: 'AI & Budget', paths: ['/api/n8n/update-ai-payer', '/api/client/budget'] },
  ];

  return (
    <div id="api-docs" className="scroll-mt-24 space-y-5">

      {/* ── Auth ── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-800">
          <h3 className="text-white text-base font-semibold">Authentication</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            All endpoints require your <code className="text-gray-400 bg-gray-800/60 px-1 py-0.5 rounded text-xs">fp_</code> API key in the Authorization header.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <CodeBlock
            lang="bash"
            code={`curl ${baseUrl}/api/v1/me \\\n  -H "Authorization: Bearer fp_your_api_key_here"`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-400">
            <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-3">
              <p className="text-white font-medium mb-1">Format</p>
              <code className="text-gray-400 font-mono">Bearer fp_&lt;64 hex chars&gt;</code>
            </div>
            <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-3">
              <p className="text-white font-medium mb-1">Scope</p>
              <p>Scoped to your account. All reads and writes act as you.</p>
            </div>
            <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-3">
              <p className="text-white font-medium mb-1">Security</p>
              <p>Never expose in client code or public repos.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Endpoints ── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-800">
          <h3 className="text-white text-base font-semibold">Endpoints</h3>
          <p className="text-gray-500 text-sm mt-0.5">Click any row to expand the request/response details.</p>
        </div>

        {categories.map((cat, ci) => {
          const catEps = endpoints.filter(ep => cat.paths.includes(ep.path));
          if (catEps.length === 0) return null;
          return (
            <div key={cat.label} className={ci > 0 ? 'border-t border-gray-800/60' : ''}>
              <div className="px-6 py-2 bg-gray-900/30">
                <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">{cat.label}</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {catEps.map((ep) => {
                  const key = ep.method + ep.path;
                  const isOpen = open === key;
                  return (
                    <div key={key}>
                      <button
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-800/20 transition-colors text-left group"
                      >
                        <MethodBadge method={ep.method} />
                        <code className="text-gray-200 text-sm font-mono flex-1">{ep.path}</code>
                        <span className="text-gray-500 text-xs hidden md:block max-w-xs truncate">{ep.description}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isOpen && (
                        <div className="px-6 pb-5 pt-1 space-y-4 bg-gray-950/20">
                          <p className="text-gray-400 text-sm">{ep.description}</p>

                          {ep.params && ep.params.length > 0 && (
                            <div>
                              <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-2">Parameters</p>
                              <div className="border border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-800/60">
                                {ep.params.map(p => (
                                  <div key={p.name} className="flex items-start gap-4 px-4 py-2.5 bg-gray-900/20">
                                    <code className="text-gray-300 text-xs font-mono w-32 flex-shrink-0">{p.name}</code>
                                    <span className="text-gray-600 text-xs w-20 flex-shrink-0">{p.in}</span>
                                    <code className="text-purple-400 text-xs font-mono w-28 flex-shrink-0">{p.type}</code>
                                    <span className="text-gray-400 text-xs flex-1">{p.description}{p.required && <span className="ml-1 text-red-400">*</span>}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-2">Request</p>
                            <CodeBlock lang="bash" code={ep.example(baseUrl)} />
                          </div>

                          <div>
                            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-2">Response</p>
                            <CodeBlock lang="json" code={ep.response} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Errors ── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-800">
          <h3 className="text-white text-base font-semibold">Error Responses</h3>
          <p className="text-gray-500 text-sm mt-0.5">All errors return a consistent JSON shape.</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <CodeBlock lang="json" code={`{\n  "success": false,\n  "error": "Unauthorized",\n  "message": "Invalid or missing API key"\n}`} />
          <div className="border border-gray-800 rounded-lg overflow-hidden divide-y divide-gray-800/60">
            {[
              ['200', 'OK',           'green',  'Request succeeded'],
              ['400', 'Bad Request',  'yellow', 'Invalid parameters or missing required fields'],
              ['401', 'Unauthorized', 'red',    'Missing or invalid API key'],
              ['403', 'Forbidden',    'red',    'Valid key but insufficient permissions'],
              ['404', 'Not Found',    'gray',   'Resource does not exist'],
              ['500', 'Server Error', 'red',    'Unexpected error — check logs'],
            ].map(([code, label, color, desc]) => {
              const codeColor = color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : color === 'red' ? 'text-red-400' : 'text-gray-400';
              return (
                <div key={code} className="flex items-center gap-4 px-4 py-2.5 bg-gray-900/20">
                  <code className={`text-xs font-mono font-bold w-8 flex-shrink-0 ${codeColor}`}>{code}</code>
                  <span className="text-gray-300 text-xs w-28 flex-shrink-0">{label}</span>
                  <span className="text-gray-500 text-xs">{desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
