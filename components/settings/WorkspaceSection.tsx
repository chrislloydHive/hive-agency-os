'use client';

// components/settings/WorkspaceSection.tsx
// Client component for workspace settings with logo upload

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';

interface WorkspaceSettings {
  workspaceName: string | null;
  logoUrl: string | null;
  timezone: string | null;
}

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
];

export function WorkspaceSection() {
  const [settings, setSettings] = useState<WorkspaceSettings>({
    workspaceName: 'Hive Agency',
    logoUrl: null,
    timezone: 'America/New_York',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings/workspace');
        if (response.ok) {
          const data = await response.json();
          setSettings({
            workspaceName: data.workspaceName || 'Hive Agency',
            logoUrl: data.logoUrl || null,
            timezone: data.timezone || 'America/New_York',
          });
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Handle logo file selection
  const handleLogoSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (500KB max)
    if (file.size > 500 * 1024) {
      setError('Image must be less than 500KB');
      return;
    }

    setIsUploadingLogo(true);
    setError(null);

    try {
      // Convert to data URL
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;

        // Upload to API
        const response = await fetch('/api/settings/workspace/logo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload logo');
        }

        const data = await response.json();
        setSettings(prev => ({ ...prev, logoUrl: data.logoUrl }));
        setSuccessMessage('Logo uploaded successfully');
      };
      reader.onerror = () => {
        throw new Error('Failed to read file');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  // Handle logo removal
  const handleRemoveLogo = useCallback(async () => {
    setIsUploadingLogo(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/workspace/logo', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove logo');
      }

      setSettings(prev => ({ ...prev, logoUrl: null }));
      setSuccessMessage('Logo removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  // Handle settings save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: settings.workspaceName,
          timezone: settings.timezone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccessMessage('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [settings.workspaceName, settings.timezone]);

  if (isLoading) {
    return (
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-6">Workspace</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-slate-800 rounded-lg w-1/2" />
          <div className="h-10 bg-slate-800 rounded-lg w-1/2" />
          <div className="h-16 bg-slate-800 rounded-lg w-32" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-100">Workspace</h2>
        {(successMessage || error) && (
          <div
            className={`text-sm px-3 py-1 rounded-full ${
              successMessage
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {successMessage || error}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={settings.workspaceName || ''}
              onChange={(e) => setSettings(prev => ({ ...prev, workspaceName: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="My Agency"
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone || 'America/New_York'}
              onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Workspace Logo
          </label>
          <div className="flex items-center gap-4">
            {/* Logo Preview */}
            <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Workspace logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-8 h-8 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingLogo ? 'Uploading...' : settings.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </button>
              {settings.logoUrl && (
                <button
                  onClick={handleRemoveLogo}
                  disabled={isUploadingLogo}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Recommended: Square image, max 500KB. PNG or JPG.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </section>
  );
}
