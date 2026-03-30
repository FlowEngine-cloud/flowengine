'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  RefreshCw,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Trash2,
  AlertCircle,
  X,
  Copy,
} from 'lucide-react';
import WidgetBuilder from './WidgetBuilder';

interface ClientInvite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  storage_size_gb: number;
  allow_full_access: boolean;
  created_at: string;
  expires_at: string;
  instance_id: string | null; // If set, agency pays; if null, client pays
  token: string;
  agency_was_invited?: boolean; // True if client invited the agency (agency accepted)
}

interface ClientInstance {
  instance_id: string;
  user_id: string;
  invite_id: string;
  instance_name: string;
  instance_url: string;
  status: string;
  storage_limit_gb: number;
  created_at: string;
  client_email: string;
}

interface Widget {
  id: string;
  name: string;
  widget_type: 'button' | 'form';
  webhook_url: string;
  form_fields: any[];
  is_active: boolean;
}

interface Execution {
  id: string;
  workflowName: string;
  status: 'success' | 'error' | 'running';
  startedAt: string;
}

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  webhookUrl?: string;
}

interface Template {
  id: string;
  name: string;
  widget_type: 'button' | 'form';
  form_fields?: any[];
  styles?: {
    buttonColor?: string;
    textColor?: string;
  };
  instance_id: string | null;
}

interface ClientsSectionProps {
  session: any;
  onInviteClick: () => void;
  onCollapse?: () => void;
  onRefreshRequest?: (refreshFn: () => void) => void;
}

export default function ClientsSection({ session, onInviteClick, onCollapse, onRefreshRequest }: ClientsSectionProps) {
  const [invites, setInvites] = useState<ClientInvite[]>([]);
  const [clientInstances, setClientInstances] = useState<Map<string, ClientInstance>>(new Map());
  const [instancesById, setInstancesById] = useState<Map<string, ClientInstance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<Map<string, Widget[]>>(new Map());
  const [loadingWidgets, setLoadingWidgets] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Map<string, Execution[]>>(new Map());
  const [workflows, setWorkflows] = useState<Map<string, Workflow[]>>(new Map());
  const [loadingWorkflows, setLoadingWorkflows] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [widgetBuilderOpen, setWidgetBuilderOpen] = useState<string | null>(null);
  const [savingWidget, setSavingWidget] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [deletingInvite, setDeletingInvite] = useState<string | null>(null);
  const [revokingAccess, setRevokingAccess] = useState<string | null>(null);
  const [resigningAccess, setResigningAccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch invites and client instances
  const fetchData = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    try {
      // Fetch invites
      const invitesRes = await fetch('/api/client/invite', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }

      // Fetch client instances (for accepted invites)
      const instancesRes = await fetch('/api/client/instances', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (instancesRes.ok) {
        const data = await instancesRes.json();
        const instanceMap = new Map<string, ClientInstance>();
        const instanceByIdMap = new Map<string, ClientInstance>();
        (data.instances || []).forEach((inst: ClientInstance) => {
          // Map by invite_id so we can look up by invite.id in the render
          if (inst.invite_id) {
            instanceMap.set(inst.invite_id, inst);
          }
          // Also map by instance_id for client-invited-agency flow
          if (inst.instance_id) {
            instanceByIdMap.set(inst.instance_id, inst);
          }
        });
        setClientInstances(instanceMap);
        setInstancesById(instanceByIdMap);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshRequest) {
      onRefreshRequest(fetchData);
    }
  }, [onRefreshRequest]);

  // Fetch UI embeds for an instance
  const fetchWidgets = async (instanceId: string) => {
    setLoadingWidgets(instanceId);
    try {
      const res = await fetch(`/api/client/widgets?instanceId=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setWidgets(prev => new Map(prev).set(instanceId, data.widgets || []));
      }
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    } finally {
      setLoadingWidgets(null);
    }
  };

  // Fetch recent executions for an instance
  const fetchExecutions = async (instanceId: string) => {
    try {
      const res = await fetch(`/api/client/instances/${instanceId}/executions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setExecutions(prev => new Map(prev).set(instanceId, data.executions || []));
      }
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    }
  };

  // Fetch workflows for an instance (for widget assignment)
  const fetchWorkflows = async (instanceId: string) => {
    setLoadingWorkflows(instanceId);
    try {
      const res = await fetch(`/api/client/workflows?preview=${instanceId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setWorkflows(prev => new Map(prev).set(instanceId, data.workflows || []));
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoadingWorkflows(null);
    }
  };

  // Fetch user's UI embed templates (for template selection)
  const fetchTemplates = async () => {
    if (templatesLoaded) return;
    try {
      const res = await fetch('/api/widget-studio/templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        // Only include templates (UI embeds without instance_id)
        const templateOnly = (data.templates || []).filter((t: Template) => !t.instance_id);
        setTemplates(templateOnly);
        setTemplatesLoaded(true);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  // Handle expanding a client
  const handleExpand = (inviteId: string, instanceId?: string) => {
    if (expandedClient === inviteId) {
      setExpandedClient(null);
    } else {
      setExpandedClient(inviteId);
      if (instanceId) {
        if (!widgets.has(instanceId)) {
          fetchWidgets(instanceId);
        }
        if (!executions.has(instanceId)) {
          fetchExecutions(instanceId);
        }
        if (!workflows.has(instanceId)) {
          fetchWorkflows(instanceId);
        }
      }
    }
  };

  // Handle creating a component
  const handleCreateWidget = async (instanceId: string, widgetData: any) => {
    setSavingWidget(true);
    try {
      const res = await fetch('/api/client/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instanceId,
          ...widgetData,
        }),
      });

      if (res.ok) {
        setWidgetBuilderOpen(null);
        fetchWidgets(instanceId);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create component');
      }
    } catch (error) {
      console.error('Failed to create component:', error);
      alert('Failed to create component');
    } finally {
      setSavingWidget(false);
    }
  };

  // Handle deleting a component
  const handleDeleteWidget = async (widgetId: string, instanceId: string) => {
    if (!confirm('Delete this component?')) return;

    try {
      const res = await fetch(`/api/client/widgets/${widgetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        fetchWidgets(instanceId);
      }
    } catch (error) {
      console.error('Failed to delete component:', error);
    }
  };

  // Handle resending invite
  const handleResendInvite = async (inviteId: string, email: string) => {
    setResendingInvite(inviteId);
    try {
      const res = await fetch('/api/client/invite/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ inviteId }),
      });

      if (res.ok) {
        alert(`Invitation resent to ${email}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resend invitation');
      }
    } catch (error) {
      console.error('Failed to resend invite:', error);
      alert('Failed to resend invitation');
    } finally {
      setResendingInvite(null);
    }
  };

  // Handle deleting invite
  const handleDeleteInvite = async (inviteId: string, email: string) => {
    if (!confirm(`Remove invitation for ${email}? This cannot be undone.`)) return;

    setDeletingInvite(inviteId);
    try {
      const res = await fetch(`/api/client/invite/${inviteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        // Remove from local state
        setInvites(prev => prev.filter(inv => inv.id !== inviteId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove invitation');
      }
    } catch (error) {
      console.error('Failed to delete invite:', error);
      alert('Failed to remove invitation');
    } finally {
      setDeletingInvite(null);
    }
  };

  // Handle revoking client access (agency-owns-instance flow)
  const handleRevokeAccess = async (instanceId: string, email: string, inviteId: string) => {
    if (!confirm(`Revoke access for ${email}? This will remove their access to the instance and delete their UI embeds.`)) return;

    setRevokingAccess(inviteId);
    try {
      // Use the correct endpoint for agency-invites-client flow
      const res = await fetch(`/api/client-panel/${instanceId}/remove-client`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        // Remove the invite from local state (backend deletes it)
        setInvites(prev => prev.filter(inv => inv.id !== inviteId));
        // Remove from client instances
        setClientInstances(prev => {
          const newMap = new Map(prev);
          newMap.delete(inviteId);
          return newMap;
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to revoke access');
      }
    } catch (error) {
      console.error('Failed to revoke access:', error);
      alert('Failed to revoke access');
    } finally {
      setRevokingAccess(null);
    }
  };

  // Handle resigning as manager (client-invited-agency flow)
  const handleResignAsManager = async (instanceId: string, email: string, inviteId: string) => {
    if (!confirm(`Resign as manager for ${email}'s instance? You will lose access to manage their instance.`)) return;

    setResigningAccess(inviteId);
    try {
      const res = await fetch(`/api/client-panel/${instanceId}/resign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        // Remove the invite from local state
        setInvites(prev => prev.filter(inv => inv.id !== inviteId));
        // Remove from client instances
        setClientInstances(prev => {
          const newMap = new Map(prev);
          newMap.delete(inviteId);
          return newMap;
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to resign');
      }
    } catch (error) {
      console.error('Failed to resign:', error);
      alert('Failed to resign');
    } finally {
      setResigningAccess(null);
    }
  };

  // Handle copying invite link
  const handleCopyLink = (invite: ClientInvite) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${baseUrl}/invite/accept-access?token=${invite.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-white/60" />
            <h3 className="text-white font-semibold">Clients</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-white/40 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-white/60" />
          <div>
            <h3 className="text-white font-semibold">Clients</h3>
            <p className="text-white/60 text-sm">Manage your invited clients</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onInviteClick}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-black font-medium rounded-lg text-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite Client
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-2 rounded-lg hover:bg-gray-800/30 text-gray-400 hover:text-gray-200 transition-colors"
              title="Collapse clients panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-700 rounded-lg">
          <Users className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 mb-2">No clients yet</p>
          <p className="text-white/30 text-sm">
            Invite clients to give them their own n8n instances
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => {
            // For client-invited-agency flow, instance comes from invite directly
            // For agency-invited-client flow, instance comes from client_instances lookup
            const clientInstance = clientInstances.get(invite.id);
            const effectiveInstanceId = invite.agency_was_invited
              ? invite.instance_id  // Client's instance (from invite)
              : clientInstance?.instance_id;  // Agency's instance (from client_instances)
            // Get instance info: from clientInstance if available, or from instancesById
            const instanceInfo = clientInstance || (effectiveInstanceId ? instancesById.get(effectiveInstanceId) : undefined);
            const isExpanded = expandedClient === invite.id;
            const instanceWidgets = widgets.get(effectiveInstanceId || '') || [];
            const instanceExecutions = executions.get(effectiveInstanceId || '') || [];

            return (
              <div
                key={invite.id}
                className="border border-gray-800 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => handleExpand(invite.id, effectiveInstanceId || undefined)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-white/50" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/50" />
                    )}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-white font-medium">{invite.email}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span>Invited {formatDate(invite.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {invite.status === 'pending' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-900/20 text-yellow-400 text-xs rounded-full">
                        <Clock className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                    {invite.status === 'accepted' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-900/20 text-green-400 text-xs rounded-full">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    )}
                    {invite.status === 'expired' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/20 text-red-400 text-xs rounded-full">
                        <XCircle className="h-3 w-3" />
                        Expired
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/50">
                    {invite.status === 'pending' && (
                      <div className="flex items-center justify-between p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-400 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Waiting for client to accept invitation
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyLink(invite)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              copiedId === invite.id
                                ? 'bg-green-900/20 text-green-400'
                                : 'bg-gray-800/30 hover:bg-gray-800/30 text-gray-400'
                            }`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === invite.id ? 'Copied' : 'Copy Link'}
                          </button>
                          <button
                            onClick={() => handleResendInvite(invite.id, invite.email)}
                            disabled={resendingInvite === invite.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/20 hover:bg-yellow-900/50 text-yellow-400 text-sm rounded-lg transition-colors"
                          >
                            {resendingInvite === invite.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Resend
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite.id, invite.email)}
                            disabled={deletingInvite === invite.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/50 text-red-400 text-sm rounded-lg transition-colors"
                          >
                            {deletingInvite === invite.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {invite.status === 'accepted' && effectiveInstanceId && (
                      <div className="space-y-3">
                        <a
                          href={`/portal/${effectiveInstanceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/30 rounded-lg transition-colors group"
                        >
                          <HardDrive className="h-4 w-4 text-white/40 group-hover:text-white/60" />
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{instanceInfo?.instance_name || 'n8n Instance'}</p>
                            <p className="text-white/40 text-xs">{instanceInfo?.instance_url?.replace('https://', '') || ''}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-white/30 group-hover:text-white/60" />
                        </a>
                        <button
                          onClick={() => handleRevokeAccess(effectiveInstanceId!, invite.email, invite.id)}
                          disabled={revokingAccess === invite.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/50 text-red-400 text-sm rounded-lg transition-colors"
                        >
                          {revokingAccess === invite.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Revoke Access
                        </button>
                      </div>
                    )}


                    {invite.status === 'expired' && (
                      <div className="flex items-center justify-between p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <XCircle className="h-4 w-4" />
                          Invitation expired on {formatDate(invite.expires_at)}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyLink(invite)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              copiedId === invite.id
                                ? 'bg-green-900/20 text-green-400'
                                : 'bg-gray-800/30 hover:bg-gray-800/30 text-gray-400'
                            }`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === invite.id ? 'Copied' : 'Copy Link'}
                          </button>
                          <button
                            onClick={() => handleResendInvite(invite.id, invite.email)}
                            disabled={resendingInvite === invite.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/20 hover:bg-yellow-900/50 text-yellow-400 text-sm rounded-lg transition-colors"
                          >
                            {resendingInvite === invite.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Resend
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite.id, invite.email)}
                            disabled={deletingInvite === invite.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/50 text-red-400 text-sm rounded-lg transition-colors"
                          >
                            {deletingInvite === invite.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Component Builder Modal */}
      {widgetBuilderOpen && (
        <WidgetBuilder
          isOpen={true}
          onClose={() => setWidgetBuilderOpen(null)}
          onSave={(widgetData) => handleCreateWidget(widgetBuilderOpen, widgetData)}
          isSaving={savingWidget}
          workflows={workflows.get(widgetBuilderOpen) || []}
          templates={templates}
          onLoadTemplates={fetchTemplates}
        />
      )}
    </div>
  );
}
