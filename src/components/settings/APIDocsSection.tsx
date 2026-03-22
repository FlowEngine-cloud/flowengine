'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
        <span className="text-gray-500 text-xs font-mono">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-100 text-black rounded text-xs font-medium transition-colors"
        >
          {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function Badge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-900/40 text-blue-400 border-blue-700/50',
    POST: 'bg-green-900/40 text-green-400 border-green-700/50',
    PUT: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50',
    DELETE: 'bg-red-900/40 text-red-400 border-red-700/50',
    PATCH: 'bg-purple-900/40 text-purple-400 border-purple-700/50',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${colors[method] ?? 'bg-gray-800 text-gray-300 border-gray-700'}`}>
      {method}
    </span>
  );
}

interface Endpoint {
  method: string;
  path: string;
  description: string;
  example: (base: string) => string;
  response: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/me',
    description: 'Returns the authenticated user\'s profile.',
    example: (base) => `curl ${base}/api/v1/me \\\n  -H "Authorization: Bearer fp_your_api_key_here"`,
    response: `{
  "success": true,
  "data": {
    "id": "uuid",
    "full_name": "Jane Smith",
    "email": "jane@example.com",
    "business_name": "Acme Corp",
    "created_at": "2025-01-15T10:00:00Z"
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/v1/instances',
    description: 'Returns all n8n instances belonging to the authenticated user.',
    example: (base) => `curl ${base}/api/v1/instances \\\n  -H "Authorization: Bearer fp_your_api_key_here"`,
    response: `{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "instance_name": "my-n8n",
      "instance_url": "https://my-n8n.example.com",
      "status": "running",
      "created_at": "2025-01-20T09:00:00Z"
    }
  ]
}`,
  },
];

export function APIDocsSection() {
  const [baseUrl, setBaseUrl] = useState('https://your-portal-url');
  const [openEndpoint, setOpenEndpoint] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <div id="api-docs" className="scroll-mt-24 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-white text-xl font-semibold mb-1">API Reference</h2>
        <p className="text-gray-400 text-sm">
          Use the REST API to manage your portal programmatically — instances, user data, and more.
          All endpoints require a Bearer token from the <a href="/portal/settings?tab=api#api-access" className="text-white underline underline-offset-2">API Key section</a> above.
        </p>
      </div>

      {/* Authentication */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-3">Authentication</h3>
        <p className="text-gray-400 text-sm mb-4">
          Pass your API key as a Bearer token in the <code className="text-gray-300 bg-gray-800/60 px-1 py-0.5 rounded text-xs">Authorization</code> header on every request.
        </p>
        <CodeBlock
          language="bash"
          code={`curl ${baseUrl}/api/v1/me \\\n  -H "Authorization: Bearer fp_your_api_key_here"`}
        />
        <div className="mt-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
          <p className="text-yellow-400 text-xs font-medium mb-1">Keep it secret</p>
          <p className="text-gray-400 text-xs">
            Never expose your key in client-side code, public repos, or URLs. Regenerate it immediately if compromised.
          </p>
        </div>
      </div>

      {/* Base URL */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-3">Base URL</h3>
        <CodeBlock language="text" code={baseUrl} />
      </div>

      {/* Endpoints */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-white font-medium">Endpoints</h3>
        </div>

        <div className="divide-y divide-gray-800">
          {ENDPOINTS.map((ep) => {
            const key = ep.method + ep.path;
            const isOpen = openEndpoint === key;
            return (
              <div key={key}>
                <button
                  onClick={() => setOpenEndpoint(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-800/30 transition-colors text-left"
                >
                  <Badge method={ep.method} />
                  <code className="text-white text-sm font-mono flex-1">{ep.path}</code>
                  <span className="text-gray-400 text-xs hidden sm:block">{ep.description}</span>
                  <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 space-y-4 bg-gray-950/30">
                    <p className="text-gray-400 text-sm">{ep.description}</p>

                    <div>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Request</p>
                      <CodeBlock language="bash" code={ep.example(baseUrl)} />
                    </div>

                    <div>
                      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Response</p>
                      <CodeBlock language="json" code={ep.response} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Errors */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-4">Error Responses</h3>
        <p className="text-gray-400 text-sm mb-4">
          All errors return JSON with a consistent shape.
        </p>
        <CodeBlock
          language="json"
          code={`{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}`}
        />

        <div className="mt-5 space-y-2">
          {[
            ['200', 'OK', 'Request succeeded'],
            ['201', 'Created', 'Resource created'],
            ['400', 'Bad Request', 'Invalid parameters'],
            ['401', 'Unauthorized', 'Missing or invalid API key'],
            ['403', 'Forbidden', 'Insufficient permissions'],
            ['404', 'Not Found', 'Resource does not exist'],
            ['500', 'Server Error', 'Unexpected error on our end'],
          ].map(([code, label, desc]) => (
            <div key={code} className="flex items-start gap-3 text-sm">
              <code className="text-gray-300 font-mono w-8 flex-shrink-0 text-xs">{code}</code>
              <span className="text-white w-28 flex-shrink-0 text-xs">{label}</span>
              <span className="text-gray-400 text-xs">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MCP note */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-2">MCP Integration</h3>
        <p className="text-gray-400 text-sm">
          Use your API key with the FlowEngine MCP server to control your portal from any AI assistant (Claude, Cursor, etc.).
          See the <a href="/portal/settings?tab=api#mcp" className="text-white underline underline-offset-2">MCP Server section</a> above for the config snippet.
        </p>
      </div>
    </div>
  );
}
