'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthContext';

export function CustomAIPrompt() {
  const { user } = useAuth();
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const MAX_LENGTH = 500;

  useEffect(() => {
    loadCustomPrompt();
  }, [user]);

  const loadCustomPrompt = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('custom_ai_prompt')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setCustomPrompt(profile.custom_ai_prompt || '');
      }
    } catch (error) {
      console.error('Error loading custom prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ custom_ai_prompt: customPrompt.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Custom AI prompt saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving custom prompt:', error);
      setMessage({ type: 'error', text: 'Failed to save custom prompt' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='bg-gray-900/50 p-6 rounded-lg border border-gray-800 animate-pulse'>
        <div className='h-6 bg-gray-800/30 rounded mb-4'></div>
        <div className='space-y-3'>
          <div className='h-4 bg-gray-800/30 rounded w-3/4'></div>
          <div className='h-4 bg-gray-800/30 rounded w-1/2'></div>
        </div>
      </div>
    );
  }

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
        <div>
          <div className='flex items-center gap-2 mb-4'>
            <h3 className='text-lg font-medium text-white'>Custom AI Instructions</h3>
          </div>

          <p className='text-sm text-gray-400 mb-4'>
            Add custom instructions for the AI to follow when creating workflows
          </p>

          <div className='relative'>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value.slice(0, MAX_LENGTH))}
              placeholder='Example: Always use descriptive node names and add error handling...'
              className='w-full h-32 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white resize-none'
              maxLength={MAX_LENGTH}
            />
            <div className='absolute bottom-3 right-3 text-xs text-gray-500'>
              {customPrompt.length}/{MAX_LENGTH}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className='w-full px-4 py-3 bg-white hover:bg-gray-200 text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
          >
            {saving ? 'Saving...' : 'Save Custom Instructions'}
          </button>
        </div>
      </div>
    </div>
  );
}
