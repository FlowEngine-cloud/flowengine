'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { User } from 'lucide-react';

export function AccountSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
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

      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });

        if (emailError) throw emailError;
        updates.email = true;
      }

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
    <div className='bg-gray-900/50 rounded-lg border border-gray-800 h-full flex flex-col'>
      {/* Messages */}
      {message && (
        <div className='p-6 pb-0'>
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-900/20 border border-green-800 text-green-400'
              : 'bg-red-900/20 border border-red-800 text-red-400'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      <div className='p-6 space-y-6'>
        {/* Profile Section */}
        <div>
          <div className='flex items-center gap-2 mb-4'>
            <User className='h-5 w-5 text-gray-400' />
            <h3 className='text-lg font-medium text-white'>Profile Information</h3>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Profile Form */}
            <form onSubmit={handleUpdateProfile} className='space-y-4'>
              <div>
                <label htmlFor='email' className='block text-sm font-medium text-gray-300 mb-2'>
                  Email
                </label>
                <input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='w-full px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                />
              </div>

              <div>
                <label htmlFor='fullName' className='block text-sm font-medium text-gray-300 mb-2'>
                  Full Name
                </label>
                <input
                  id='fullName'
                  type='text'
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className='w-full px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Your full name'
                />
              </div>

              <button
                type='submit'
                disabled={loading}
                className='w-full px-4 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-400 text-black text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed'
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            {/* Password Form */}
            <form onSubmit={handleUpdatePassword} className='space-y-4'>
              <div>
                <label htmlFor='newPassword' className='block text-sm font-medium text-gray-300 mb-2'>
                  New Password
                </label>
                <input
                  id='newPassword'
                  type='password'
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className='w-full px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Min. 6 characters'
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-300 mb-2'>
                  Confirm Password
                </label>
                <input
                  id='confirmPassword'
                  type='password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className='w-full px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Confirm password'
                  minLength={6}
                />
              </div>

              <button
                type='submit'
                disabled={loading || !newPassword || !confirmPassword}
                className='w-full px-4 py-2 bg-white hover:bg-gray-100 disabled:bg-gray-400 text-black text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed'
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className='pt-4 border-t border-gray-800 flex items-center justify-end'>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))}
            className='text-sm text-gray-400 hover:text-white transition-colors cursor-pointer'
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
