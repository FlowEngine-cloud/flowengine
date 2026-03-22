'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';

export function UserProfileEditor() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName(user.user_metadata?.full_name || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const updates: any = {};

      // Update email if changed
      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });

        if (emailError) throw emailError;
        updates.email = true;
      }

      // Update full name if changed
      if (fullName !== user?.user_metadata?.full_name) {
        const { error: nameError } = await supabase.auth.updateUser({
          data: { full_name: fullName }
        });

        if (nameError) throw nameError;
        updates.name = true;
      }

      if (updates.email || updates.name) {
        setMessage({
          type: 'success',
          text: updates.email
            ? 'Profile updated! Please check your new email for confirmation.'
            : 'Profile updated successfully!'
        });
      } else {
        setMessage({
          type: 'success',
          text: 'No changes to save.'
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to update profile'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({
        type: 'error',
        text: 'New passwords do not match'
      });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 6 characters'
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Password updated successfully!'
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to update password'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {message && (
        <div className={`mb-3 p-3 rounded text-sm ${
          message.type === 'success'
            ? 'bg-white/5 border border-white/10 text-white'
            : 'bg-white/5 border border-white/20 text-white'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-black border border-white/10 rounded-lg p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="block text-xs text-white/60 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="fullName" className="block text-xs text-white/60 mb-1.5">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="Your name"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-white text-black hover:bg-white/90 disabled:bg-white/50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>

          {/* Change Password */}
          <div className="border-l border-white/10 pl-6">
            <h3 className="text-sm font-medium text-white mb-3">Change Password</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label htmlFor="newPassword" className="block text-xs text-white/60 mb-1.5">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="Min. 6 characters"
                    minLength={6}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs text-white/60 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                    placeholder="Confirm"
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="px-4 py-2 bg-white text-black hover:bg-white/90 disabled:bg-white/50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
