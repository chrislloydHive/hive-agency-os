'use client';

// components/os/context/ManualContextQuickAdd.tsx
// Manual Context Quick-Add Panel
//
// Streamlined panel for quickly adding key context fields when no labs have run.
// Designed for imported strategy flow where users want to add key facts manually.
//
// Shows priority fields: ICP description, value proposition, goals, constraints

import { useState, useCallback } from 'react';
import { Plus, Check, Loader2, FileText } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface ManualContextQuickAddProps {
  companyId: string;
  onFieldAdded?: (fieldKey: string, value: string) => void;
}

interface QuickAddField {
  key: string;
  label: string;
  placeholder: string;
  description: string;
}

// Priority fields for manual entry (Strategy Ready Minimum)
const QUICK_ADD_FIELDS: QuickAddField[] = [
  {
    key: 'audience.icpDescription',
    label: 'Target Audience (ICP)',
    placeholder: 'e.g., B2B SaaS companies with 50-200 employees...',
    description: 'Who is your ideal customer?',
  },
  {
    key: 'productOffer.valueProposition',
    label: 'Value Proposition',
    placeholder: 'e.g., We help teams reduce deployment time by 50%...',
    description: 'What unique value do you provide?',
  },
  {
    key: 'brand.positioning',
    label: 'Brand Positioning',
    placeholder: 'e.g., The most reliable DevOps platform for enterprise...',
    description: 'How should your brand be perceived?',
  },
  {
    key: 'strategyFrame.intent',
    label: 'Strategic Goals',
    placeholder: 'e.g., Increase market share in healthcare vertical...',
    description: 'What are you trying to achieve?',
  },
];

// ============================================================================
// Component
// ============================================================================

export function ManualContextQuickAdd({ companyId, onFieldAdded }: ManualContextQuickAddProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleValueChange = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    // Clear saved state when editing
    setSaved(prev => ({ ...prev, [key]: false }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  const handleSave = useCallback(async (fieldKey: string) => {
    const value = values[fieldKey]?.trim();
    if (!value) return;

    setSaving(prev => ({ ...prev, [fieldKey]: true }));
    setErrors(prev => ({ ...prev, [fieldKey]: '' }));

    try {
      const response = await fetch('/api/os/context/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          nodeKey: fieldKey,
          value,
          source: 'user',
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(prev => ({ ...prev, [fieldKey]: true }));
      onFieldAdded?.(fieldKey, value);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [fieldKey]: error instanceof Error ? error.message : 'Failed to save',
      }));
    } finally {
      setSaving(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [companyId, values, onFieldAdded]);

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-cyan-500/10 rounded-lg">
          <FileText className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Add Key Facts</h3>
          <p className="text-xs text-slate-500">
            Quickly add context to improve strategy quality
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {QUICK_ADD_FIELDS.map((field) => {
          const isSaving = saving[field.key];
          const isSaved = saved[field.key];
          const error = errors[field.key];
          const value = values[field.key] || '';

          return (
            <div key={field.key} className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">
                {field.label}
              </label>
              <div className="flex gap-2">
                <textarea
                  value={value}
                  onChange={(e) => handleValueChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={2}
                  className="flex-1 px-3 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none"
                />
                <button
                  onClick={() => handleSave(field.key)}
                  disabled={!value.trim() || isSaving}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center ${
                    isSaved
                      ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                      : value.trim()
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isSaved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">{field.description}</p>
              {error && (
                <p className="text-[10px] text-red-400">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-500 mt-4 pt-3 border-t border-slate-700/50">
        These fields feed into strategy generation. Add more context anytime via the full Context page.
      </p>
    </div>
  );
}

export default ManualContextQuickAdd;
