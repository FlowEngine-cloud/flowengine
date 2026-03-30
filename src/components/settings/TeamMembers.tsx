'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

export function TeamMembers() {
  const { session } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/team/members', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setMembers(data.members || []);
    } catch (e) {
      console.error('Failed to load team members:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !session?.access_token) return;

    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send invitation');
        return;
      }

      if (data.emailSent === false) {
        setSuccess(`Invitation created for ${email.trim()} but email delivery failed — check your SMTP settings.`);
      } else {
        setSuccess(`Invitation sent to ${email.trim()}`);
      }
      setEmail('');
      fetchMembers();
    } catch {
      setError('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!session?.access_token) return;

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== memberId));
      }
    } catch (e) {
      console.error('Failed to remove member:', e);
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!session?.access_token) return;

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      }
    } catch (e) {
      console.error('Failed to update role:', e);
    }
  };

  const activeCount = members.filter(m => m.status === 'accepted').length;
  const pendingCount = members.filter(m => m.status === 'pending').length;

  return (
    <div className='bg-gray-900/50 p-6 rounded-lg border border-gray-800'>
      <p className='text-white/60 text-sm mb-6'>
        Invite team members to share access to your portal, instances, and workflows.
      </p>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className='mb-6'>
        <div className='flex flex-col sm:flex-row gap-3'>
          <input
            type='email'
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); setSuccess(null); }}
            placeholder='team@example.com'
            className='flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white text-sm'
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className='px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white text-sm focus:ring-2 focus:ring-white focus:border-white'
          >
            <option value='member'>Member (read-only)</option>
            <option value='manager'>Manager (no billing)</option>
            <option value='admin'>Admin (full access)</option>
          </select>
          <button
            type='submit'
            disabled={inviting || !email.trim()}
            className='px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'
          >
            {inviting ? <Loader2 className='h-4 w-4 animate-spin mx-auto' /> : 'Send Invite'}
          </button>
        </div>

        {error && <p className='mt-2 text-sm text-red-400'>{error}</p>}
        {success && <p className='mt-2 text-sm text-green-400'>{success}</p>}
      </form>

      {/* Members Table */}
      {loading ? (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='h-5 w-5 animate-spin text-gray-400' />
        </div>
      ) : members.length === 0 ? (
        <p className='text-white/40 text-sm text-center py-6'>No team members yet.</p>
      ) : (
        <>
          {/* Stats */}
          <div className='flex gap-4 mb-4 text-xs text-white/40'>
            <span>{activeCount} active</span>
            {pendingCount > 0 && <span>{pendingCount} pending</span>}
          </div>

          {/* Header */}
          <div className='hidden sm:grid grid-cols-[1fr_120px_80px_80px] gap-3 px-3 pb-2 text-xs text-white/40 border-b border-gray-800'>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span></span>
          </div>

          {/* Rows */}
          <div className='divide-y divide-gray-800/50'>
            {members.map(member => {
              const isConfirming = confirmRemove === member.id;

              return (
                <div
                  key={member.id}
                  className='flex flex-col sm:grid sm:grid-cols-[1fr_120px_80px_80px] gap-2 sm:gap-3 items-start sm:items-center px-3 py-3'
                >
                  <span className='text-white text-sm truncate w-full'>{member.email}</span>

                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value)}
                    className='px-2 py-1 bg-gray-900/50 border border-gray-800 rounded text-xs text-white focus:ring-1 focus:ring-white'
                  >
                    <option value='member'>Member</option>
                    <option value='manager'>Manager</option>
                    <option value='admin'>Admin</option>
                  </select>

                  <span className={`text-xs ${member.status === 'accepted' ? 'text-green-400' : 'text-white/50'}`}>
                    {member.status === 'accepted' ? 'Active' : 'Pending'}
                  </span>

                  <div className='flex justify-end w-full sm:w-auto'>
                    {isConfirming ? (
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={() => handleRemove(member.id)}
                          className='px-2 py-1 rounded text-xs text-red-400 hover:bg-red-900/20 transition-colors'
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className='px-2 py-1 rounded text-xs text-white/40 hover:text-white transition-colors'
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(member.id)}
                        className='px-2 py-1 rounded text-xs text-white/40 hover:text-red-400 transition-colors'
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
