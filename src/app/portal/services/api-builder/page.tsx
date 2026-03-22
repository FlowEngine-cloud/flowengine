'use client';

import { useState, useCallback } from 'react';
import { useServicesContext } from '../context';
import { supabase } from '@/lib/supabase';
import { Copy, Check, Trash2 } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';

// ─── API Builder action definitions ──────────────────────────────────────────

interface ActionParam {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
}

interface ActionDef {
  action: string;
  label: string;
  category: 'Messaging' | 'Chat Management' | 'Session';
  tab: 'send' | 'receive';
  method: 'POST' | 'PUT' | 'DELETE' | 'GET';
  path: string;
  params: ActionParam[];
  buildBody: (p: Record<string, string>) => Record<string, unknown>;
}

const API_BUILDER_ACTIONS: ActionDef[] = [
  // ── Messaging ──
  {
    action: 'sendText', label: 'Send Text', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendText/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'text', label: 'Message', placeholder: 'Hello!', required: true, type: 'textarea' },
    ],
    buildBody: (p) => ({ number: p.to, text: p.text }),
  },
  {
    action: 'sendMedia', label: 'Send Media', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendMedia/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'mediaUrl', label: 'Media URL', placeholder: 'https://example.com/image.png', required: true },
      { key: 'mediatype', label: 'Media Type', type: 'select', options: [
        { value: 'image', label: 'Image' }, { value: 'video', label: 'Video' },
        { value: 'document', label: 'Document' }, { value: 'audio', label: 'Audio' },
      ]},
      { key: 'caption', label: 'Caption', placeholder: 'Check this out!' },
      { key: 'fileName', label: 'File Name', placeholder: 'photo.png' },
    ],
    buildBody: (p) => ({ number: p.to, media: p.mediaUrl, ...(p.mediatype && { mediatype: p.mediatype }), ...(p.caption && { caption: p.caption }), ...(p.fileName && { fileName: p.fileName }) }),
  },
  {
    action: 'sendAudio', label: 'Send Audio', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendWhatsAppAudio/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'audioUrl', label: 'Audio URL', placeholder: 'https://example.com/audio.mp3', required: true },
    ],
    buildBody: (p) => ({ number: p.to, audio: p.audioUrl }),
  },
  {
    action: 'sendLocation', label: 'Send Location', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendLocation/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'latitude', label: 'Latitude', placeholder: '37.7749', required: true, type: 'number' },
      { key: 'longitude', label: 'Longitude', placeholder: '-122.4194', required: true, type: 'number' },
      { key: 'name', label: 'Location Name', placeholder: 'San Francisco' },
      { key: 'address', label: 'Address', placeholder: '123 Main St' },
    ],
    buildBody: (p) => ({ number: p.to, latitude: parseFloat(p.latitude || '0'), longitude: parseFloat(p.longitude || '0'), ...(p.name && { name: p.name }), ...(p.address && { address: p.address }) }),
  },
  {
    action: 'sendContact', label: 'Send Contact', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendContact/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'contactName', label: 'Contact Name', placeholder: 'John Doe', required: true },
      { key: 'contactNumber', label: 'Contact Number', placeholder: '0987654321', required: true },
    ],
    buildBody: (p) => ({ number: p.to, contact: [{ fullName: p.contactName, wuid: p.contactNumber, phoneNumber: p.contactNumber }] }),
  },
  {
    action: 'sendReaction', label: 'Send Reaction', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendReaction/{instanceName}',
    params: [
      { key: 'remoteJid', label: 'Chat ID', placeholder: '5511999999999@s.whatsapp.net or group@g.us', required: true },
      { key: 'messageId', label: 'Message ID', placeholder: 'ABCDEF123456', required: true },
      { key: 'reaction', label: 'Emoji', placeholder: '👍', required: true },
    ],
    buildBody: (p) => ({ key: { remoteJid: p.remoteJid, id: p.messageId }, reaction: p.reaction }),
  },
  {
    action: 'sendPoll', label: 'Send Poll', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendPoll/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'title', label: 'Poll Title', placeholder: 'What do you prefer?', required: true },
      { key: 'options', label: 'Poll Options', placeholder: 'Option A, Option B, Option C (comma-separated)', required: true },
      { key: 'selectableCount', label: 'Max Selections', placeholder: '1', type: 'number' },
    ],
    buildBody: (p) => ({ number: p.to, name: p.title, values: (p.options || '').split(',').map((o: string) => o.trim()).filter(Boolean), ...(p.selectableCount && { selectableCount: parseInt(p.selectableCount, 10) }) }),
  },
  {
    action: 'sendSticker', label: 'Send Sticker', category: 'Messaging', tab: 'send', method: 'POST',
    path: '/message/sendSticker/{instanceName}',
    params: [
      { key: 'to', label: 'Send To (one number per request)', placeholder: '5511999999999 or 120363xxx@g.us (group)', required: true },
      { key: 'stickerUrl', label: 'Sticker URL', placeholder: 'https://example.com/sticker.webp', required: true },
    ],
    buildBody: (p) => ({ number: p.to, sticker: p.stickerUrl }),
  },
  // ── Session (send) ──
  {
    action: 'setPresence', label: 'Set Presence', category: 'Session', tab: 'send', method: 'POST',
    path: '/instance/setPresence/{instanceName}',
    params: [
      { key: 'presence', label: 'Presence', type: 'select', required: true, options: [
        { value: 'available', label: 'Available' }, { value: 'unavailable', label: 'Unavailable' },
        { value: 'composing', label: 'Composing' }, { value: 'recording', label: 'Recording' },
        { value: 'paused', label: 'Paused' },
      ]},
    ],
    buildBody: (p) => ({ presence: p.presence }),
  },
  // ── Chat (receive) ──
  {
    action: 'checkNumbers', label: 'Verify Numbers on WhatsApp', category: 'Chat Management', tab: 'receive', method: 'POST',
    path: '/chat/whatsappNumbers/{instanceName}',
    params: [
      { key: 'numbers', label: 'Numbers to Check', placeholder: 'Leave empty for all, or: 5511999999999, 5522888888888' },
    ],
    buildBody: (p) => {
      const nums = (p.numbers || '').split(',').map((n: string) => n.trim()).filter(Boolean);
      return nums.length > 0 ? { numbers: nums } : {};
    },
  },
  {
    action: 'fetchMessages', label: 'Fetch Messages', category: 'Chat Management', tab: 'receive', method: 'POST',
    path: '/chat/findMessages/{instanceName}',
    params: [
      { key: 'remoteJid', label: 'Chat ID', placeholder: '5511999999999@s.whatsapp.net or group@g.us', required: true },
      { key: 'limit', label: 'Limit', placeholder: '20', type: 'number' },
    ],
    buildBody: (p) => ({ where: { key: { remoteJid: p.remoteJid } }, limit: parseInt(p.limit || '20', 10) }),
  },
  {
    action: 'markRead', label: 'Mark as Read', category: 'Chat Management', tab: 'receive', method: 'PUT',
    path: '/chat/markMessageAsRead/{instanceName}',
    params: [
      { key: 'remoteJid', label: 'Chat ID', placeholder: '5511999999999@s.whatsapp.net or group@g.us', required: true },
      { key: 'messageId', label: 'Message ID', placeholder: 'ABCDEF123456', required: true },
    ],
    buildBody: (p) => ({ readMessages: [{ remoteJid: p.remoteJid, id: p.messageId }] }),
  },
  {
    action: 'archiveChat', label: 'Archive / Unarchive Chat', category: 'Chat Management', tab: 'receive', method: 'PUT',
    path: '/chat/archiveChat/{instanceName}',
    params: [
      { key: 'chatJid', label: 'Chat ID', placeholder: '5511999999999@s.whatsapp.net or group@g.us', required: true },
      { key: 'archive', label: 'Action', type: 'select', required: true, options: [
        { value: 'true', label: 'Archive' }, { value: 'false', label: 'Unarchive' },
      ]},
    ],
    buildBody: (p) => ({ lastMessage: { key: { remoteJid: p.chatJid } }, archive: p.archive === 'true' }),
  },
  {
    action: 'deleteMessage', label: 'Delete Message', category: 'Chat Management', tab: 'receive', method: 'DELETE',
    path: '/chat/deleteMessage/{instanceName}',
    params: [
      { key: 'remoteJid', label: 'Chat ID', placeholder: '5511999999999@s.whatsapp.net or group@g.us', required: true },
      { key: 'messageId', label: 'Message ID', placeholder: 'ABCDEF123456', required: true },
      { key: 'onlyForMe', label: 'Scope', type: 'select', options: [
        { value: 'false', label: 'For Everyone' }, { value: 'true', label: 'Only For Me' },
      ]},
    ],
    buildBody: (p) => ({ key: { remoteJid: p.remoteJid, id: p.messageId }, ...(p.onlyForMe && { onlyForMe: p.onlyForMe === 'true' }) }),
  },
  // ── Groups (receive) ──
  {
    action: 'listGroups', label: 'List All Groups', category: 'Session', tab: 'receive', method: 'GET',
    path: '/group/fetchAllGroups/{instanceName}?getParticipants=false',
    params: [],
    buildBody: () => ({}),
  },
  {
    action: 'groupInfo', label: 'Get Group Info', category: 'Session', tab: 'receive', method: 'GET',
    path: '/group/findGroupInfos/{instanceName}',
    params: [
      { key: 'groupJid', label: 'Group JID', placeholder: '120363xxx@g.us', required: true },
    ],
    buildBody: () => ({}),
  },
  {
    action: 'groupParticipants', label: 'Get Group Participants', category: 'Session', tab: 'receive', method: 'GET',
    path: '/group/participants/{instanceName}',
    params: [
      { key: 'groupJid', label: 'Group JID', placeholder: '120363xxx@g.us', required: true },
    ],
    buildBody: () => ({}),
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function APIBuilderPage() {
  const { connections, loading, liveStatus } = useServicesContext();

  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [action, setAction] = useState('sendText');
  const [params, setParams] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<'curl' | 'fetch' | 'json'>('curl');
  const [copied, setCopied] = useState(false);

  // API keys fetched per instance
  const [fetchedKeys, setFetchedKeys] = useState<Record<string, string>>({});

  // Saved snippets
  const [savedApis, setSavedApis] = useState<{ name: string; action: string; params: Record<string, string>; format: 'curl' | 'fetch' | 'json'; tab: 'send' | 'receive'; instance?: string }[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('wa_saved_apis') || '[]'); } catch { return []; }
  });
  const [savedApiName, setSavedApiName] = useState('');
  const [showSavePopup, setShowSavePopup] = useState(false);

  const connectedInstances = connections.filter(c => {
    const s = liveStatus[c.id] || c.status;
    return s === 'open' || s === 'connected' || s === 'active';
  });

  const fetchApiKey = useCallback(async (instanceName: string) => {
    if (fetchedKeys[instanceName]) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`/api/whatsapp/${instanceName}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      const key = data.instance?.sessionToken;
      if (key) {
        setFetchedKeys(prev => ({ ...prev, [instanceName]: key }));
      }
    } catch {
      // Silent
    }
  }, [fetchedKeys]);

  const generateApiCode = (): string => {
    const actionDef = API_BUILDER_ACTIONS.find(a => a.action === action);
    if (!actionDef) return '// Select an action';
    const conn = connections.find(c => c.instance_name === selectedInstance);
    if (!conn?.server_url) return '// Select a number first';
    const apiKey = fetchedKeys[selectedInstance] || 'YOUR_API_KEY';
    const instanceName = selectedInstance || '{instance_name}';
    let url = `${conn.server_url}${actionDef.path.replace('{instanceName}', instanceName)}`;
    const isGet = actionDef.method === 'GET';
    if (isGet && actionDef.params.length > 0) {
      const qs = actionDef.params.map(p => `${p.key}=${encodeURIComponent(params[p.key] || `{${p.key}}`)}`).join('&');
      url += (url.includes('?') ? '&' : '?') + qs;
    }
    const tplParams: Record<string, string> = {};
    for (const p of actionDef.params) {
      tplParams[p.key] = params[p.key] || `{${p.key}}`;
    }
    const body = actionDef.buildBody(tplParams);
    const bodyStr = JSON.stringify(body, (_, v) => (typeof v === 'number' && isNaN(v)) ? '{number}' : v, 2);
    const hasBody = actionDef.params.length > 0 && !isGet;
    if (format === 'json') {
      if (!hasBody) return `// GET ${actionDef.path}\n// No request body - params are in the URL`;
      return bodyStr;
    }
    if (format === 'curl') {
      let cmd = `curl -X ${actionDef.method} "${url}" \\\n  -H "apikey: ${apiKey}"`;
      if (hasBody) {
        cmd += ` \\\n  -H "Content-Type: application/json"`;
        cmd += ` \\\n  -d '${bodyStr}'`;
      }
      return cmd;
    }
    // fetch
    const opts: string[] = [`  method: '${actionDef.method}'`];
    opts.push(`  headers: {\n    'apikey': '${apiKey}',\n    'Content-Type': 'application/json'\n  }`);
    if (hasBody) {
      opts.push(`  body: JSON.stringify(${bodyStr.split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')})`);
    }
    return `const response = await fetch('${url}', {\n${opts.join(',\n')}\n});\n\nconst data = await response.json();\nconsole.log(data);`;
  };

  const saveApiSnippet = () => {
    const actionDef = API_BUILDER_ACTIONS.find(a => a.action === action);
    const name = savedApiName.trim() || actionDef?.label || action;
    const entry: (typeof savedApis)[number] = {
      name, action, params: { ...params },
      format, tab, instance: selectedInstance,
    };
    const updated = [...savedApis, entry];
    setSavedApis(updated);
    localStorage.setItem('wa_saved_apis', JSON.stringify(updated));
    setSavedApiName('');
  };

  const loadApiSnippet = (idx: number) => {
    const s = savedApis[idx];
    if (!s) return;
    setTab(s.tab);
    setAction(s.action);
    setParams(s.params);
    setFormat(s.format);
    if (s.instance) {
      setSelectedInstance(s.instance);
      if (!fetchedKeys[s.instance]) fetchApiKey(s.instance);
    }
  };

  const deleteApiSnippet = (idx: number) => {
    const updated = savedApis.filter((_, i) => i !== idx);
    setSavedApis(updated);
    localStorage.setItem('wa_saved_apis', JSON.stringify(updated));
  };

  if (loading) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          {/* Header row: tabs + save */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-800/30 rounded-lg p-1">
              {(['send', 'receive'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setAction(API_BUILDER_ACTIONS.find(a => a.tab === t)?.action || 'sendText');
                    setParams({});
                  }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize cursor-pointer ${
                    tab === t ? 'bg-white text-black' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowSavePopup(!showSavePopup); setSavedApiName(''); }}
                className="px-3 py-1.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Save
              </button>
              {showSavePopup && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900/90 border border-gray-700 rounded-lg p-3 z-10 shadow-xl">
                  <input
                    ref={(el) => el?.focus()}
                    value={savedApiName}
                    onChange={(e) => setSavedApiName(e.target.value)}
                    placeholder="Give it a name..."
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && savedApiName.trim()) {
                        await saveApiSnippet();
                        setShowSavePopup(false);
                      }
                      if (e.key === 'Escape') setShowSavePopup(false);
                    }}
                    className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 mb-2"
                  />
                  <button
                    onClick={async () => { if (savedApiName.trim()) { await saveApiSnippet(); setShowSavePopup(false); } }}
                    disabled={!savedApiName.trim()}
                    className="w-full px-3 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-600 disabled:text-gray-400 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Controls row: number + action side by side */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm text-white/40 block mb-1">Number ID</label>
              <SearchableSelect
                value={selectedInstance}
                onChange={(val) => {
                  setSelectedInstance(val);
                  if (val && !fetchedKeys[val]) fetchApiKey(val);
                }}
                placeholder="Select number..."
                options={[
                  { value: '', label: 'Select number...' },
                  ...connectedInstances.map(c => ({
                    value: c.instance_name,
                    label: `${c.phone_number ? `+${c.phone_number}` : c.instance_name}${c.display_name ? ` - ${c.display_name}` : ''}`,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="text-sm text-white/40 block mb-1">Action</label>
              <SearchableSelect
                value={action}
                onChange={(val) => { setAction(val); setParams({}); }}
                placeholder="Select action..."
                options={API_BUILDER_ACTIONS.filter(a => a.tab === tab).map(a => ({
                  value: a.action,
                  label: a.label,
                }))}
              />
            </div>
          </div>

          {/* Params + code output side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[180px]">
            {/* Left: parameters */}
            <div className="space-y-3">
              {(() => {
                const actionDef = API_BUILDER_ACTIONS.find(a => a.action === action);
                if (!actionDef || actionDef.params.length === 0) return <p className="text-sm text-white/30 py-4">No parameters needed</p>;
                return actionDef.params.map(param => (
                  <div key={param.key}>
                    <label className="text-sm text-white/40 block mb-1">
                      {param.label}{param.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {param.type === 'select' ? (
                      <SearchableSelect
                        value={params[param.key] || param.options?.[0]?.value || ''}
                        onChange={(val) => setParams(prev => ({ ...prev, [param.key]: val }))}
                        placeholder={`Select ${param.label.toLowerCase()}...`}
                        options={param.options || []}
                      />
                    ) : param.type === 'textarea' ? (
                      <textarea
                        value={params[param.key] || ''}
                        onChange={(e) => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                        placeholder={param.placeholder}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 resize-none"
                      />
                    ) : (
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={params[param.key] || ''}
                        onChange={(e) => setParams(prev => ({ ...prev, [param.key]: e.target.value }))}
                        placeholder={param.placeholder}
                        className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500"
                      />
                    )}
                  </div>
                ));
              })()}
            </div>

            {/* Right: generated code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex gap-1">
                  {(['curl', 'fetch', 'json'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`px-2.5 py-1 text-sm rounded border transition-colors cursor-pointer ${
                        format === fmt
                          ? 'bg-white text-black border-white'
                          : 'text-white/40 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateApiCode());
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title="Copy"
                  className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 cursor-pointer"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <pre className="bg-black/40 border border-gray-800 rounded-lg p-3 text-sm font-mono text-white/70 overflow-auto whitespace-pre-wrap min-h-[120px] max-h-[280px]">
                {generateApiCode()}
              </pre>
            </div>
          </div>

          {/* Saved entries */}
          {savedApis.length > 0 && (
            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                {savedApis.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-gray-800/30 border-b border-gray-800 last:border-0">
                    <button
                      onClick={() => loadApiSnippet(i)}
                      className="flex-1 text-left text-sm text-white/70 hover:text-white truncate cursor-pointer"
                    >
                      <span className="text-white/30 mr-2 uppercase">{s.format}</span>
                      {s.name}
                    </button>
                    <button
                      onClick={() => deleteApiSnippet(i)}
                      className="p-1 text-gray-500 hover:text-red-400 flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
