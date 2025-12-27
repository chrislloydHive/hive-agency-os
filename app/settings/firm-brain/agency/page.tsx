'use client';

// app/settings/firm-brain/agency/page.tsx
// Agency Profile Editor

import { useState, useEffect, useCallback } from 'react';
import { Building2, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AgencyProfile } from '@/lib/types/firmBrain';

export default function AgencyProfilePage() {
  const [profile, setProfile] = useState<Partial<AgencyProfile>>({
    name: '',
    oneLiner: '',
    overviewLong: '',
    differentiators: [],
    services: [],
    industries: [],
    approachSummary: '',
    collaborationModel: '',
    aiStyleGuide: '',
    defaultAssumptions: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Text inputs for array fields
  const [diffInput, setDiffInput] = useState('');
  const [servInput, setServInput] = useState('');
  const [indInput, setIndInput] = useState('');
  const [assumpInput, setAssumpInput] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/settings/firm-brain/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            setProfile(data.profile);
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/settings/firm-brain/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [profile]);

  const addToArray = (field: 'differentiators' | 'services' | 'industries' | 'defaultAssumptions', value: string) => {
    if (!value.trim()) return;
    setProfile(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()],
    }));
  };

  const removeFromArray = (field: 'differentiators' | 'services' | 'industries' | 'defaultAssumptions', index: number) => {
    setProfile(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Building2 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Agency Profile</h1>
            <p className="text-sm text-slate-400">Your agency's core identity and capabilities</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-6 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Basic Info</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Agency Name *</label>
            <input
              type="text"
              value={profile.name || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Hive Agency"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">One-liner</label>
            <input
              type="text"
              value={profile.oneLiner || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, oneLiner: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="A brief tagline that captures your agency's essence"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Full Overview</label>
            <textarea
              value={profile.overviewLong || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, overviewLong: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              placeholder="A comprehensive description of your agency..."
            />
          </div>
        </div>

        {/* Differentiators */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Differentiators</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={diffInput}
              onChange={(e) => setDiffInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('differentiators', diffInput);
                  setDiffInput('');
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Add a differentiator..."
            />
            <button
              onClick={() => {
                addToArray('differentiators', diffInput);
                setDiffInput('');
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.differentiators || []).map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-300 text-sm rounded-lg"
              >
                {item}
                <button
                  onClick={() => removeFromArray('differentiators', i)}
                  className="text-purple-400 hover:text-purple-300 ml-1"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Services</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={servInput}
              onChange={(e) => setServInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('services', servInput);
                  setServInput('');
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Add a service..."
            />
            <button
              onClick={() => {
                addToArray('services', servInput);
                setServInput('');
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.services || []).map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-300 text-sm rounded-lg"
              >
                {item}
                <button
                  onClick={() => removeFromArray('services', i)}
                  className="text-blue-400 hover:text-blue-300 ml-1"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Industries */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Industries</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={indInput}
              onChange={(e) => setIndInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('industries', indInput);
                  setIndInput('');
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Add an industry..."
            />
            <button
              onClick={() => {
                addToArray('industries', indInput);
                setIndInput('');
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.industries || []).map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-300 text-sm rounded-lg"
              >
                {item}
                <button
                  onClick={() => removeFromArray('industries', i)}
                  className="text-emerald-400 hover:text-emerald-300 ml-1"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Approach & Collaboration */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Approach</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Approach Summary</label>
            <textarea
              value={profile.approachSummary || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, approachSummary: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              placeholder="How you approach client engagements..."
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Collaboration Model</label>
            <textarea
              value={profile.collaborationModel || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, collaborationModel: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              placeholder="How you work with clients day-to-day..."
            />
          </div>
        </div>

        {/* AI Style Guide */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">AI Settings</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1">AI Style Guide</label>
            <textarea
              value={profile.aiStyleGuide || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, aiStyleGuide: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              placeholder="Tone and style guidance for AI-generated content..."
            />
            <p className="text-xs text-slate-500 mt-1">
              This guides how AI writes content for your agency
            </p>
          </div>
        </div>

        {/* Default Assumptions */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Default Assumptions</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={assumpInput}
              onChange={(e) => setAssumpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addToArray('defaultAssumptions', assumpInput);
                  setAssumpInput('');
                }
              }}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Add a default assumption for proposals..."
            />
            <button
              onClick={() => {
                addToArray('defaultAssumptions', assumpInput);
                setAssumpInput('');
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          <div className="space-y-1">
            {(profile.defaultAssumptions || []).map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg"
              >
                <span className="text-sm text-slate-300">{item}</span>
                <button
                  onClick={() => removeFromArray('defaultAssumptions', i)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
