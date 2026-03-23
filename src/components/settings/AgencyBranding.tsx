'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, Upload, Trash2, RefreshCw } from 'lucide-react';
import { updateCachedAgencyLogo } from '@/hooks/useAgencyLogo';

export function AgencyBranding() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [serverBusinessName, setServerBusinessName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_logo_url, business_name')
        .eq('id', user.id)
        .single();

      if (profile?.agency_logo_url) {
        setLogoUrl(profile.agency_logo_url);
      }
      if (profile?.business_name) {
        setBusinessName(profile.business_name);
        setServerBusinessName(profile.business_name);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    setSavingName(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ business_name: businessName.trim() || null })
        .eq('id', user.id);

      if (error) throw error;

      setServerBusinessName(businessName.trim());
      setMessage({ type: 'success', text: 'Business name saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save business name' });
    } finally {
      setSavingName(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 2MB' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Ensure bucket exists (handles deployments where db-migrate ran before storage was ready)
      await fetch('/api/storage/ensure-bucket', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // Upload to Supabase storage (dedicated agency-branding bucket)
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('agency-branding')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('agency-branding')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ agency_logo_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) {
        throw updateError;
      }

      setLogoUrl(publicUrl);
      // Update cache for loading spinners
      if (user?.id) {
        updateCachedAgencyLogo(publicUrl, user.id);
      }
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to upload logo' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ agency_logo_url: null })
        .eq('id', user.id);

      if (error) throw error;

      setLogoUrl(null);
      // Update cache for loading spinners
      updateCachedAgencyLogo(null, user.id);
      setMessage({ type: 'success', text: 'Logo removed successfully!' });
    } catch (error: any) {
      console.error('Error removing logo:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to remove logo' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-medium text-white">Name and Logo</h3>
      </div>

      <p className="text-white/60 text-sm mb-4">
        Set your business name and logo. These replace FlowEngine branding in the client dashboard.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-900/20 border border-green-800 text-green-400'
            : 'bg-red-900/20 border border-red-800 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Business Name */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <label className="block text-sm text-white/60 mb-2">Business Name</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Your business name"
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:ring-2 focus:ring-white focus:border-white"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || businessName.trim() === serverBusinessName}
              className="px-4 py-3 bg-white text-black hover:bg-gray-100 disabled:bg-gray-400 disabled:text-gray-600 rounded-lg text-sm font-medium transition-colors"
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Shown to clients instead of &quot;FlowEngine&quot;
          </p>
        </div>

        {/* Current Logo Preview */}
        {logoUrl && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
            <p className="text-white/60 text-sm mb-3">Current Logo</p>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden border border-gray-700">
                <img
                  src={logoUrl}
                  alt="Agency logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <button
                onClick={handleRemoveLogo}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remove Logo
              </button>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="logo-upload"
          />
          <label
            htmlFor="logo-upload"
            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-gray-500 transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw className="h-8 w-8 text-white/40 animate-spin mb-2" />
                <span className="text-white/60 text-sm">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-white/40 mb-2" />
                <span className="text-white font-medium mb-1">
                  {logoUrl ? 'Change Logo' : 'Upload Logo'}
                </span>
                <span className="text-white/40 text-sm">
                  PNG, JPG, or SVG (max 2MB)
                </span>
              </>
            )}
          </label>
        </div>

        {/* Preview Info */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
          <p className="text-white/60 text-sm">
How it works: Your logo will replace the FlowEngine branding in the client dashboard header. Clients will see your logo when they access their automation hub.
          </p>
        </div>
      </div>
    </div>
  );
}
