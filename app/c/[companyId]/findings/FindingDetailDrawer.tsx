'use client';

// app/c/[companyId]/findings/FindingDetailDrawer.tsx
// Side drawer showing full details of a finding with work item conversion

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface FindingDetailDrawerProps {
  finding: DiagnosticDetailFinding | null;
  onClose: () => void;
  onConvertToWorkItem: (finding: DiagnosticDetailFinding) => Promise<any>;
  companyId: string;
}

// ============================================================================
// Severity Badge
// ============================================================================

const severityColors: Record<string, { bg: string; text: string; ring: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  low: { bg: 'bg-slate-500/20', text: 'text-slate-400', ring: 'ring-slate-500/30' },
};

function SeverityBadgeLarge({ severity }: { severity?: string }) {
  const colors = severityColors[severity || 'medium'] || severityColors.medium;
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
        ${colors.bg} ${colors.text} ring-1 ${colors.ring} capitalize
      `}
    >
      {severity || 'Medium'} Severity
    </span>
  );
}

// ============================================================================
// Detail Row Component
// ============================================================================

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono text-cyan-400' : 'text-slate-300'}`}>
        {value}
      </dd>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FindingDetailDrawer({
  finding,
  onClose,
  onConvertToWorkItem,
  companyId,
}: FindingDetailDrawerProps) {
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState(false);

  // Reset state when finding changes
  useEffect(() => {
    setConverting(false);
    setConvertError(null);
    setConvertSuccess(false);
  }, [finding?.id]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleConvert = async () => {
    if (!finding) return;

    setConverting(true);
    setConvertError(null);
    setConvertSuccess(false);

    try {
      await onConvertToWorkItem(finding);
      setConvertSuccess(true);
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : 'Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  if (!finding) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md">
        <div className="flex h-full flex-col bg-slate-900 border-l border-slate-800 shadow-xl">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-medium text-white">
                Finding Details
              </h2>
              <div className="mt-2">
                <SeverityBadgeLarge severity={finding.severity} />
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-300 p-1"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <dl className="space-y-6">
              {/* Lab & Category */}
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Lab" value={finding.labSlug} />
                <DetailRow label="Category" value={finding.category} />
              </div>

              {/* Dimension */}
              <DetailRow label="Dimension" value={finding.dimension} />

              {/* Location */}
              <DetailRow label="Location" value={finding.location} mono />

              {/* Description */}
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Description
                </dt>
                <dd className="mt-2 text-sm text-slate-300 leading-relaxed">
                  {finding.description || 'No description available.'}
                </dd>
              </div>

              {/* Recommendation */}
              {finding.recommendation && (
                <div>
                  <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Recommendation
                  </dt>
                  <dd className="mt-2 text-sm text-slate-300 leading-relaxed bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    {finding.recommendation}
                  </dd>
                </div>
              )}

              {/* Estimated Impact */}
              <DetailRow
                label="Estimated Impact"
                value={finding.estimatedImpact?.toString()}
              />

              {/* Issue Key */}
              <DetailRow label="Issue Key" value={finding.issueKey} mono />
            </dl>
          </div>

          {/* Footer / Actions */}
          <div className="border-t border-slate-800 px-6 py-4">
            {/* Work Item Status */}
            {finding.isConvertedToWorkItem ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-emerald-400">Converted to Work Item</span>
                </div>
                <Link
                  href={`/c/${companyId}/work`}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  View Work Item
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {convertError && (
                  <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                    {convertError}
                  </div>
                )}

                {convertSuccess && (
                  <div className="text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
                    Successfully converted to work item!
                  </div>
                )}

                <button
                  onClick={handleConvert}
                  disabled={converting || convertSuccess}
                  className={`
                    w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors
                    ${converting || convertSuccess
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    }
                  `}
                >
                  {converting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin w-4 h-4" />
                      Converting...
                    </span>
                  ) : convertSuccess ? (
                    'Converted!'
                  ) : (
                    'Convert to Work Item'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
