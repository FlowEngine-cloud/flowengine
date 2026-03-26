'use client';

/**
 * WebsitePortalContent — Simple manage panel for non-n8n instances.
 * Used for service_type: 'website', 'docker', 'openclaw', 'other', or unknown.
 * Shows: URL (copy + external link), editable notes, link to Hosting page.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ExternalLink, Copy, Check, Loader2, Pencil, Server,
} from 'lucide-react';

interface Props {
  instanceId: string;
  instanceName: string;
  instanceUrl?: string;
  status?: string;
}

export function WebsitePortalContent({ instanceId, instanceName, instanceUrl, status }: Props) {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);

  // Notes
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
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Sub-header */}
      <div className="border-b border-gray-800 bg-black px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {instanceUrl ? (
            <>
              <a
                href={instanceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm truncate flex items-center gap-1"
              >
                {instanceUrl.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <button
                onClick={copyUrl}
                className="p-1 rounded hover:bg-gray-800 text-gray-500 hover:text-white transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <span className="text-gray-600 text-sm">No URL configured</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
          <span className="text-xs text-gray-400 capitalize">{isOnline ? 'Online' : (status || 'Unknown')}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 space-y-4 max-w-xl">
        {/* Notes */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40">Notes</p>
            {notesLoaded && !editingNotes && (
              <button
                onClick={() => { setNotesDraft(notes || ''); setEditingNotes(true); }}
                className="p-1 rounded hover:bg-gray-700 text-white/30 hover:text-white/60 transition-colors"
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
                rows={3}
                placeholder="Add a note about this instance…"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-white resize-y"
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
                  className="px-3 py-1.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/70 whitespace-pre-wrap">
              {notes || <span className="text-white/30">No notes — click the pencil to add one.</span>}
            </p>
          )}
        </div>

        {/* Hosting link */}
        <Link
          href={`/portal/hosting/${instanceId}`}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/50 border border-gray-800 hover:border-gray-700 rounded-lg text-sm text-white/70 hover:text-white transition-colors w-fit"
        >
          <Server className="w-4 h-4" />
          Manage in Hosting
          <ExternalLink className="w-3.5 h-3.5 text-white/30" />
        </Link>
      </div>
    </div>
  );
}
