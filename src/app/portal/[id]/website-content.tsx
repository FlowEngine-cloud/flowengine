'use client';

/**
 * WebsitePortalContent — Simple manage panel for non-n8n instances.
 * Used for service_type: 'website', 'docker', 'openclaw', 'other', or unknown.
 * Shows: URL (copy + external link), editable notes.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { ExternalLink, Copy, Check, Loader2, Pencil } from 'lucide-react';

interface Props {
  instanceId: string;
  instanceName: string;
  instanceUrl?: string;
  status?: string;
}

export function WebsitePortalContent({ instanceId, instanceName, instanceUrl, status }: Props) {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);

  const [notes, setNotes] = useState<string | null>(null);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('pay_per_instance_deployments')
      .select('notes')
      .eq('id', instanceId)
      .maybeSingle()
      .then(({ data }) => {
        setNotes((data as any)?.notes || null);
        setNotesLoaded(true);
      });
  }, [instanceId]);

  const saveNotes = async () => {
    if (!session?.access_token) return;
    setNotesSaving(true);
    try {
      const res = await fetch('/api/hosting/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ instanceId, notes: notesDraft.trim() }),
      });
      if (res.ok) {
        setNotes(notesDraft.trim() || null);
        setEditingNotes(false);
      }
    } catch { /* silent */ } finally {
      setNotesSaving(false);
    }
  };

  const copyUrl = () => {
    if (!instanceUrl) return;
    navigator.clipboard.writeText(instanceUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isOnline = status === 'running' || status === 'active';

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Sub-header */}
      <div className="border-b border-gray-800 px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {instanceUrl ? (
            <>
              <a
                href={instanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm truncate flex items-center gap-1.5 transition-colors"
              >
                {instanceUrl.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <button
                onClick={copyUrl}
                className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors shrink-0"
                title="Copy URL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <span className="text-white/20 text-sm">No URL configured</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
          <span className="text-xs text-white/40 capitalize">{isOnline ? 'Online' : (status || 'Unknown')}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Notes</p>
            {notesLoaded && !editingNotes && (
              <button
                onClick={() => { setNotesDraft(notes || ''); setEditingNotes(true); }}
                className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Add a note about this instance…"
                className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500 resize-none placeholder:text-white/20 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveNotes}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {notesSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="px-3 py-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { if (notesLoaded) { setNotesDraft(notes || ''); setEditingNotes(true); } }}
              className="min-h-[80px] cursor-text rounded-lg px-3 py-2.5 bg-gray-900/40 border border-transparent hover:border-gray-800 transition-colors"
            >
              {notesLoaded ? (
                notes
                  ? <p className="text-sm text-white/70 whitespace-pre-wrap">{notes}</p>
                  : <p className="text-sm text-white/20">No notes — click to add one.</p>
              ) : (
                <p className="text-sm text-white/20">Loading…</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
