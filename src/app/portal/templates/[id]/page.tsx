'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { usePortalRoleContext } from '@/app/portal/context';
import { useTemplatesContext } from '../context';
import {
  Download, FileText, Clock, Hash, Upload, Loader2, Trash2, X,
  Pencil, ArrowUpCircle,
} from 'lucide-react';
import CredentialIcon from '@/components/credentials/CredentialIcon';
import N8nDemo from '@/components/N8nDemo';
import { WorkflowProcessor } from '@/lib/workflowProcessor';

interface TemplateDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  workflow_json: Record<string, unknown> | null;
  required_credentials: Array<{ type: string; name: string; icon: string }>;
  import_count: number;
  version: number;
  changelog: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const { role } = usePortalRoleContext();
  const { refetch } = useTemplatesContext();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit metadata state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  // Update version state
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateFile, setUpdateFile] = useState<Record<string, unknown> | null>(null);
  const [updateFileName, setUpdateFileName] = useState('');
  const [updateChangelog, setUpdateChangelog] = useState('');
  const [updating, setUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifyUsersOnUpdate, setNotifyUsersOnUpdate] = useState(true);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTemplate = async () => {
    if (authLoading || !session) return;
    try {
      const res = await fetch(`/api/n8n-templates/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplate(data.template);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplate();
  }, [authLoading, session, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEditing = () => {
    if (!template) return;
    setEditName(template.name);
    setEditDescription(template.description || '');
    setEditCategory(template.category || '');
    setEditIcon(template.icon || '');
    setIsEditing(true);
  };

  const handleSaveMeta = async () => {
    if (!session || !template || !editName.trim()) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/n8n-templates/${template.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          category: editCategory.trim() || null,
          icon: editIcon.trim() || null,
        }),
      });
      if (res.ok) {
        setTemplate(prev => prev ? { ...prev, name: editName.trim(), description: editDescription.trim() || null, category: editCategory.trim() || null, icon: editIcon.trim() || null } : prev);
        setIsEditing(false);
        showToast('success', 'Template updated');
        refetch();
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save');
      }
    } catch {
      showToast('error', 'Failed to save');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (!json.nodes || !Array.isArray(json.nodes) || json.nodes.length === 0) {
          showToast('error', 'Invalid workflow: must contain at least one node');
          return;
        }
        setUpdateFile(json);
        setUpdateFileName(file.name);
      } catch {
        showToast('error', 'Invalid JSON file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateVersion = async () => {
    if (!session || !template || !updateFile) return;
    if (!updateChangelog.trim()) {
      showToast('error', 'Please describe what changed in this update');
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/n8n-templates/${template.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          category: template.category,
          icon: template.icon,
          workflow_json: updateFile,
          changelog: updateChangelog.trim(),
          notify_users: notifyUsersOnUpdate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const versionMsg = data.template?.version ? ` (v${data.template.version})` : '';
        showToast('success', `Template updated${versionMsg}`);
        setShowUpdateForm(false);
        setUpdateFile(null);
        setUpdateFileName('');
        setUpdateChangelog('');
        setLoading(true);
        fetchTemplate();
        refetch();
      } else {
        showToast('error', data.message || data.error || 'Failed to update template');
      }
    } catch {
      showToast('error', 'Failed to update template');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/n8n-templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        showToast('success', 'Template deleted');
        refetch();
        router.push('/portal/templates');
      } else {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete');
      }
    } catch {
      showToast('error', 'Failed to delete');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
            <div className="h-5 w-48 bg-gray-800/30 rounded animate-pulse" />
            <div className="h-24 bg-gray-800/30 rounded-lg animate-pulse" />
            <div className="h-64 bg-gray-800/30 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="w-8 h-8 text-white/40 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Template not found</p>
        </div>
      </div>
    );
  }

  const isAgency = role !== 'client';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Info card */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          {isEditing ? (
            /* ── Edit Mode ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Edit Template</p>
                <button onClick={() => setIsEditing(false)} className="p-1 rounded hover:bg-gray-700 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
                <label className="text-sm text-white/60 pt-2.5">Icon</label>
                <input
                  type="text"
                  value={editIcon}
                  onChange={e => setEditIcon(e.target.value)}
                  placeholder="⚡"
                  className="w-20 px-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white text-center focus:ring-2 focus:ring-white focus:border-white outline-none"
                />
                <label className="text-sm text-white/60 pt-2.5">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
                />
                <label className="text-sm text-white/60 pt-2.5">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="What does this template do?"
                  rows={2}
                  className="px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none resize-none"
                />
                <label className="text-sm text-white/60 pt-2.5">Category</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  placeholder="e.g. Marketing, Sales, Support"
                  className="px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMeta}
                  disabled={savingMeta || !editName.trim()}
                  className="px-4 py-2.5 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  {savingMeta ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl shrink-0">
                  {template.icon || '⚡'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 text-sm mb-2">
                    {template.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-white/40">
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {template.import_count} imports
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      v{template.version}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(template.created_at).toLocaleDateString()}
                    </span>
                    {template.category && (
                      <span className="px-3 py-1 text-xs rounded-full bg-gray-800/30 text-gray-400 border border-gray-700">
                        {template.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions — agency only */}
              {isAgency && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-800 flex-wrap">
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Details
                  </button>
                  <button
                    onClick={() => setShowUpdateForm(!showUpdateForm)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium border border-gray-700 transition-colors"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Update Workflow
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-900/20 rounded-lg text-sm border border-gray-700 hover:border-red-800 transition-colors ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </>
          )}

          {/* Update Version Form */}
          {showUpdateForm && !isEditing && (
            <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Update to v{template.version + 1}
                </p>
                <button onClick={() => { setShowUpdateForm(false); setUpdateFile(null); setUpdateFileName(''); setUpdateChangelog(''); }} className="p-1 rounded hover:bg-gray-700 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* File upload */}
              <div>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-700 hover:border-gray-600 rounded-lg text-sm text-gray-400 hover:text-white/60 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {updateFile ? updateFileName : 'Select workflow JSON file'}
                </button>
                {updateFile && (
                  <p className="text-sm text-white/40 mt-1.5">
                    {((updateFile as { nodes?: unknown[] }).nodes || []).length} nodes detected
                  </p>
                )}
              </div>

              {/* Changelog */}
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">What changed?</label>
                <textarea
                  value={updateChangelog}
                  onChange={(e) => setUpdateChangelog(e.target.value)}
                  placeholder="Describe the changes in this version..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white outline-none resize-none"
                />
              </div>

              {/* Notify users */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyUsersOnUpdate}
                  onChange={(e) => setNotifyUsersOnUpdate(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900/50 text-white focus:ring-white accent-white"
                />
                <span className="text-sm text-white/60">Notify clients about this update</span>
              </label>

              {/* Submit */}
              <button
                onClick={handleUpdateVersion}
                disabled={!updateFile || !updateChangelog.trim() || updating}
                className="w-full px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
              >
                {updating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  `Publish v${template.version + 1}`
                )}
              </button>
            </div>
          )}

          {/* Required credentials */}
          {template.required_credentials.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-white/60 font-medium uppercase tracking-wider mb-3">Required Credentials</p>
              <div className="flex flex-wrap gap-2">
                {template.required_credentials.map((cred) => (
                  <div key={cred.type} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/30 border border-gray-700 rounded-lg">
                    <CredentialIcon type={cred.icon} className="h-4 w-4" />
                    <span className="text-sm text-white/80">{cred.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Changelog */}
          {template.changelog && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-sm text-white/60 font-medium uppercase tracking-wider mb-2">Changelog</p>
              <p className="text-sm text-white/70">{template.changelog}</p>
            </div>
          )}
        </div>

        {/* Workflow preview */}
        {template.workflow_json && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white">Workflow Preview</span>
              <span className="text-sm text-white/40 ml-auto">
                {(template.workflow_json as { nodes?: unknown[] }).nodes
                  ? `${((template.workflow_json as { nodes: unknown[] }).nodes).length} nodes`
                  : ''}
              </span>
            </div>
            <div className="h-[400px]">
              <N8nDemo workflow={WorkflowProcessor.ensureAIAgentStructure(template.workflow_json)} />
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-white mb-2">Delete Template</h3>
            <p className="text-sm text-white/60 mb-6">
              Are you sure you want to delete &ldquo;{template.name}&rdquo;? This cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-3 border border-gray-700 hover:bg-gray-700 text-white/60 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-400 border border-green-800' : 'bg-red-900/90 text-red-400 border border-red-800'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
