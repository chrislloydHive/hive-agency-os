'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyRecord } from '@/lib/airtable/companies';
import { updateCompanyMetaAction } from '@/app/companyMetaActions';

interface CompanyMetaEditDialogProps {
  company: CompanyRecord;
  onClose: () => void;
}

export function CompanyMetaEditDialog({ company, onClose }: CompanyMetaEditDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [stage, setStage] = useState(company.stage || '');
  const [lifecycleStatus, setLifecycleStatus] = useState(company.lifecycleStatus || '');
  const [tier, setTier] = useState(company.tier || '');
  const [owner, setOwner] = useState(company.owner || '');
  const [tags, setTags] = useState(company.tags?.join(', ') || '');
  const [internalNotes, setInternalNotes] = useState(company.internalNotes || '');

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse tags from comma-separated string
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await updateCompanyMetaAction({
        companyId: company.id,
        stage: (stage as CompanyRecord['stage']) || undefined,
        lifecycleStatus: lifecycleStatus || undefined,
        tier: (tier as CompanyRecord['tier']) || undefined,
        owner: owner || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        internalNotes: internalNotes || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update company meta');
      }

      // Refresh and close
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Manage Company Meta
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {company.name}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="px-6 py-4 space-y-4">
              {/* Stage */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">Not set</option>
                  <option value="Prospect">Prospect</option>
                  <option value="Client">Client</option>
                  <option value="Internal">Internal</option>
                  <option value="Dormant">Dormant</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              {/* Lifecycle Status */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Lifecycle Status
                </label>
                <input
                  type="text"
                  value={lifecycleStatus}
                  onChange={(e) => setLifecycleStatus(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., Active, Onboarding, Churned..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              {/* Tier */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tier
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">Not set</option>
                  <option value="A">Tier A</option>
                  <option value="B">Tier B</option>
                  <option value="C">Tier C</option>
                </select>
              </div>

              {/* Owner */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g., enterprise, priority, demo (comma-separated)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Separate tags with commas
                </p>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                  placeholder="Private notes about this company..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 resize-none"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-300">
                  <span className="font-medium">Error:</span> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
