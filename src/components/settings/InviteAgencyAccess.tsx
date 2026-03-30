'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';
import {
  Send,
  RefreshCw,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle,
  Copy
} from 'lucide-react';

interface Instance {
  id: string;
  instance_name: string;
  storage_limit_gb: number;
  invited_by_user_id: string | null;
  agencyName?: string;
}

interface AgencyInvite {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  instance_id: string;
  instance_name?: string;
  token: string;
}

export function InviteAgencyAccess() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);

    try {
      // Fetch user's pay-per-instances with invited_by info
      const { data: userInstances, error: instancesError } = await supabase
        .from('pay_per_instance_deployments')
        .select('id, instance_name, storage_limit_gb, invited_by_user_id')
        .eq('user_id', user.id)
        .eq('status', 'running');

      if (instancesError) {
        console.error('Error loading instances:', instancesError);
        setLoadError('Failed to load instances. Please refresh the page.');
        return;
      }

      // Fetch agency names for instances that have managers
      const managedInstances = (userInstances || []).filter(i => i.invited_by_user_id);
      const agencyIds = [...new Set(managedInstances.map(i => i.invited_by_user_id))];

      let agencyMap: Record<string, string> = {};
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', agencyIds);

        agencies?.forEach(a => {
          agencyMap[a.id] = a.full_name || 'Agency';
        });
      }

      // Add agency names to instances
      const instancesWithAgency = (userInstances || []).map(inst => ({
        ...inst,
        agencyName: inst.invited_by_user_id ? agencyMap[inst.invited_by_user_id] : undefined
      }));

      setInstances(instancesWithAgency);

      // Fetch invites sent by this user (for agency management)
      // These are invites where user is NOT pro+ (instance owner inviting agency)
      const { data: userInvites, error: invitesError } = await supabase
        .from('client_invites')
        .select('id, email, status, created_at, instance_id, token')
        .eq('invited_by', user.id)
        .not('instance_id', 'is', null)
        .order('created_at', { ascending: false });

      if (invitesError) {
        console.error('Error loading invites:', invitesError);
        setLoadError('Failed to load invitations. Please refresh the page.');
        return;
      }

      // Filter invites to only show ones for user-owned instances
      // This prevents showing agency-to-client invites for Pro+ users
      const ownedInstanceIds = instancesWithAgency.map((i: Instance) => i.id);
      const invitesWithNames = (userInvites || [])
        .filter(invite => invite.instance_id && ownedInstanceIds.includes(invite.instance_id))
        .map(invite => {
          const instance = instancesWithAgency.find((i: Instance) => i.id === invite.instance_id);
          return {
            ...invite,
            instance_name: instance?.instance_name || 'Unknown Instance'
          };
        });

      setInvites(invitesWithNames as AgencyInvite[]);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError('An unexpected error occurred. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      setEmailError('Please enter an email address');
      return;
    }
    if (!validateEmail(email.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (!selectedInstanceId) {
      setEmailError('Please select an instance');
      return;
    }

    setEmailError('');
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setEmailError('Please sign in to continue');
        return;
      }

      const response = await fetch('/api/client/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          existingInstanceId: selectedInstanceId,
          allowFullAccess: true, // Agency gets full access
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setEmailError(data.error || 'Failed to send invitation');
        return;
      }

      // Success - reset form and reload
      setEmail('');
      setSelectedInstanceId('');
      await loadData();
    } catch (error) {
      console.error('Error sending invite:', error);
      setEmailError('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleRevokeDirectAccess = async (instanceId: string) => {
    if (!confirm('Are you sure you want to revoke agency access? They will lose all access to manage this instance.')) {
      return;
    }

    setRevoking(instanceId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !user) {
        setEmailError('Please sign in to continue');
        return;
      }

      // Use the API endpoint to revoke access (handles invite status update too)
      const response = await fetch(`/api/client/instances/${instanceId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error revoking access:', data.error);
        setEmailError(data.error || 'Failed to revoke access');
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Error revoking access:', error);
      setEmailError('Failed to revoke access');
    } finally {
      setRevoking(null);
    }
  };

  const handleDelete = async (inviteId: string) => {
    if (!user) return;

    setCancelling(inviteId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setEmailError('Please sign in to continue');
        return;
      }

      // Use API endpoint to cancel invite (handles RLS properly)
      const response = await fetch(`/api/client/invite/${inviteId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error cancelling invite:', data.error);
        setEmailError(data.error || 'Failed to cancel invite');
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Error cancelling invite:', error);
      setEmailError('Failed to cancel invite');
    } finally {
      setCancelling(null);
    }
  };

  const handleCopyLink = (invite: AgencyInvite) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${baseUrl}/invite/accept?token=${invite.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-yellow-900/20 border border-yellow-900/40 text-yellow-400">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-green-900/20 border border-green-800 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-gray-900/50 border border-gray-700 text-gray-400">
            <XCircle className="w-3 h-3" />
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-red-900/20 border border-red-800 text-red-400">
            <XCircle className="w-3 h-3" />
            Revoked
          </span>
        );
      default:
        return null;
    }
  };

  // Filter out instances that already have a manager OR have a pending invite
  const pendingInviteInstanceIds = invites
    .filter(invite => invite.status === 'pending')
    .map(invite => invite.instance_id);

  const availableInstances = instances.filter(i =>
    !i.invited_by_user_id && !pendingInviteInstanceIds.includes(i.id)
  );

  // Instances that have an active agency manager
  const managedInstances = instances.filter(i => i.invited_by_user_id);

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Show error state
  if (loadError) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  // Show message if user has no instances
  if (instances.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Invite Agency to Manage</h3>
            <p className="text-white/60 text-sm">
              Let an agency manage your instance
            </p>
          </div>
        </div>
        <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
            <p className="text-white/60 text-sm">
              You need to deploy an n8n instance first before you can invite an agency to manage it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine header based on state
  const allManaged = managedInstances.length > 0 && availableInstances.length === 0;
  const hasPendingOnly = pendingInviteInstanceIds.length > 0 && managedInstances.length === 0 && availableInstances.length === 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-6">
      {/* Header - changes based on state */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800/30 border border-gray-700 flex items-center justify-center">
          <Users className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h3 className="text-white font-medium">
            {allManaged ? 'Agency Management' : hasPendingOnly ? 'Pending Agency Invitations' : 'Invite Agency to Manage'}
          </h3>
          <p className="text-white/60 text-sm">
            {allManaged
              ? `${managedInstances.length === 1 ? 'Your instance is' : 'Your instances are'} managed by an agency`
              : hasPendingOnly
              ? 'Waiting for agency to accept'
              : 'Let an agency manage your instance'}
          </p>
        </div>
      </div>

      {/* Invite Form - only for unmanaged instances */}
      {availableInstances.length > 0 ? (
        <div className="space-y-4">
          {/* Show note if some instances are already managed */}
          {managedInstances.length > 0 && (
            <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <p className="text-blue-300 text-sm">
                Note: The form below is for your <strong>unmanaged</strong> instances only.
                Your managed instances are shown in "Active Agency Access" below.
              </p>
            </div>
          )}

          {/* Instance Selection */}
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Select Unmanaged Instance
            </label>
            <div className="relative">
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full px-4 py-3 pr-10 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors appearance-none cursor-pointer"
              >
                <option value="">Choose an instance...</option>
                {availableInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instance_name} ({inst.storage_limit_gb}GB)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Agency Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="agency@example.com"
              className={`w-full px-4 py-3 bg-gray-900/50 border rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors ${
                emailError ? 'border-red-500/50' : 'border-gray-800'
              }`}
            />
            {emailError && (
              <p className="text-red-400 text-xs mt-2">{emailError}</p>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
              <p className="text-white/60 text-sm">
                The agency must have an active subscription to accept this invitation.
                They will get full management access to your instance.
              </p>
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={handleInvite}
            disabled={sending || !selectedInstanceId || !email.trim()}
            className="w-full py-3 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 transition-all flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Invitation</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
            <div className="text-white/60 text-sm">
              {instances.every(i => i.invited_by_user_id || pendingInviteInstanceIds.includes(i.id)) ? (
                <>
                  <p className="font-medium text-white mb-1">One agency per instance</p>
                  <p>Each instance can only be managed by one agency at a time. To invite a different agency, revoke the current access first.</p>
                </>
              ) : (
                <p>You need a running instance to invite an agency.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Currently Managed Instances */}
      {managedInstances.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-white/60 text-sm font-medium">Active Agency Access</h4>
          <div className="space-y-2">
            {managedInstances.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between p-4 bg-gray-800/30 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">{inst.instance_name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Managed by {inst.agencyName || 'Agency'}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-green-900/20 border border-green-800 text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Active
                  </span>
                  <button
                    onClick={() => handleRevokeDirectAccess(inst.id)}
                    disabled={revoking === inst.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 hover:bg-red-900/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                    title="Revoke agency access"
                  >
                    {revoking === inst.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Invites */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-white/60 text-sm font-medium">Sent Invitations</h4>
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 bg-gray-800/30 border border-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{invite.email}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {invite.instance_name} • {new Date(invite.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {getStatusBadge(invite.status)}
                  {(invite.status === 'accepted' || invite.status === 'pending') && (
                    <button
                      onClick={() => handleCopyLink(invite)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        copiedId === invite.id
                          ? 'border-green-700 bg-green-900/20 text-green-400'
                          : 'border-blue-800/50 hover:bg-blue-900/20 text-blue-400'
                      }`}
                      title="Copy invitation link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === invite.id ? 'Copied' : 'Copy Link'}
                    </button>
                  )}
                  {invite.status === 'accepted' && (
                    <button
                      onClick={() => handleDelete(invite.id)}
                      disabled={cancelling === invite.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 hover:bg-red-900/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                      title="Revoke access"
                    >
                      {cancelling === invite.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Revoke
                    </button>
                  )}
                  {invite.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(invite.id)}
                      disabled={cancelling === invite.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/50 hover:bg-red-900/20 text-red-400 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Cancel invitation"
                    >
                      {cancelling === invite.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {cancelling === invite.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                  {invite.status === 'expired' && (
                    <button
                      onClick={() => handleDelete(invite.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                      title="Delete invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
