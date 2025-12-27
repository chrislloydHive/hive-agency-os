'use client';

// components/os/library/PromoteToGlobalDialog.tsx
// Confirmation dialog for promoting a section to global

import { useState, useEffect } from 'react';
import { X, Loader2, Globe, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ReusableSection, LeakageCheckResult } from '@/lib/types/sectionLibrary';

interface PromoteToGlobalDialogProps {
  companyId: string;
  section: ReusableSection;
  onClose: () => void;
  onPromoted?: (globalSection: ReusableSection) => void;
}

export function PromoteToGlobalDialog({
  companyId,
  section,
  onClose,
  onPromoted,
}: PromoteToGlobalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [leakageCheck, setLeakageCheck] = useState<LeakageCheckResult | null>(null);
  const [leakageSummary, setLeakageSummary] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for leakage on mount
  useEffect(() => {
    const checkLeakage = async () => {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/section-library/${section.id}/promote`
        );
        const data = await response.json();

        if (response.ok) {
          setLeakageCheck(data.leakageCheck);
          setLeakageSummary(data.leakageSummary);
        }
      } catch (err) {
        console.error('Failed to check leakage:', err);
      } finally {
        setChecking(false);
      }
    };

    checkLeakage();
  }, [companyId, section.id]);

  const handlePromote = async () => {
    if (!confirmed) {
      setError('Please confirm that the content contains no client-specific details');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/section-library/${section.id}/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmNoClientSpecificContent: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to promote section');
      }

      onPromoted?.(data.globalSection);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote section');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Promote to Global</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Section preview */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <h4 className="font-medium text-white">{section.title}</h4>
            <p className="text-sm text-slate-400 mt-1 line-clamp-3">
              {section.content.slice(0, 200)}{section.content.length > 200 ? '...' : ''}
            </p>
          </div>

          {/* Leakage check */}
          {checking ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking for client-specific content...
            </div>
          ) : leakageCheck?.hasWarnings ? (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-amber-400">Potential Issues Detected</h4>
                  <p className="text-sm text-amber-300/80 mt-1">{leakageSummary}</p>
                  <ul className="mt-2 space-y-1">
                    {leakageCheck.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i} className="text-xs text-amber-300/70">• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              No obvious client-specific content detected
            </div>
          )}

          {/* Info box */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-purple-300">What happens when you promote?</h4>
            <ul className="mt-2 space-y-1 text-xs text-purple-300/80">
              <li>• A new global section will be created (original is kept)</li>
              <li>• Global sections are visible to all companies</li>
              <li>• Company-specific references will be removed</li>
            </ul>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
            />
            <span className="text-sm text-slate-300">
              I confirm that this content contains <strong className="text-white">no client-specific details</strong> (names, proprietary information, confidential data)
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePromote}
            disabled={loading || !confirmed}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Globe className="w-4 h-4" />
            Promote to Global
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromoteToGlobalDialog;
