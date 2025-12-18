// components/flows/ReadinessGateModal.tsx
// Flow readiness gate modal
//
// Shows when a flow cannot proceed due to missing critical data.
// Provides:
// - List of missing critical domains with Lab CTAs
// - List of missing recommended domains
// - "Proceed Anyway" option (requires acknowledgment)

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  type FlowReadiness,
  getFlowDisplayName,
} from '@/lib/os/flow/readiness.shared';

interface ReadinessGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onRunLab: (labKey: string) => void;
  readiness: FlowReadiness;
  companyId: string;
}

type ProceedReason = 'testing' | 'time_constraint' | 'data_unavailable' | 'other';

export function ReadinessGateModal({
  isOpen,
  onClose,
  onProceed,
  onRunLab,
  readiness,
  companyId,
}: ReadinessGateModalProps) {
  const [acknowledgeChecked, setAcknowledgeChecked] = useState(false);
  const [proceedReason, setProceedReason] = useState<ProceedReason | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAcknowledgeChecked(false);
      setProceedReason(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const flowName = getFlowDisplayName(readiness.flow);
  const hasCriticalMissing = readiness.missingCritical.length > 0;
  const canProceedAnyway = readiness.canProceedAnyway && acknowledgeChecked && proceedReason;

  const handleProceedAnyway = () => {
    // Note: Telemetry logging is handled server-side via the onProceed callback
    onClose();
    onProceed();
  };

  const primaryLabCta = readiness.labCTAs.find(cta => cta.priority === 'critical');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-700">
          <div className="p-2.5 rounded-lg bg-red-500/20">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Missing Context for {flowName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Required data is missing to run this flow
            </p>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="ml-auto p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Critical Missing Domains */}
          {hasCriticalMissing && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Critical - Required
              </p>
              <div className="space-y-2">
                {readiness.missingCritical.map((domain) => {
                  const labCta = readiness.labCTAs.find(cta => cta.domain === domain.domain);
                  return (
                    <DomainItem
                      key={domain.domain}
                      label={domain.label}
                      status="critical"
                      labName={labCta?.labName}
                      labHref={labCta?.href}
                      onRunLab={labCta ? () => onRunLab(labCta.labKey) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommended Missing Domains */}
          {readiness.missingRecommended.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                Recommended
              </p>
              <div className="space-y-2">
                {readiness.missingRecommended.map((domain) => {
                  const labCta = readiness.labCTAs.find(cta => cta.domain === domain.domain);
                  return (
                    <DomainItem
                      key={domain.domain}
                      label={domain.label}
                      status="recommended"
                      labName={labCta?.labName}
                      labHref={labCta?.href}
                      onRunLab={labCta ? () => onRunLab(labCta.labKey) : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Proceed Anyway Section */}
          {readiness.canProceedAnyway && (
            <div className="border-t border-slate-700 pt-5">
              <p className="text-xs text-slate-400 mb-3">
                You can proceed anyway, but output quality may be reduced.
              </p>

              {/* Acknowledgment checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={acknowledgeChecked}
                    onChange={(e) => setAcknowledgeChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                </div>
                <span className="text-sm text-slate-300 group-hover:text-slate-200">
                  I understand this may produce lower-quality results
                </span>
              </label>

              {/* Reason dropdown */}
              {acknowledgeChecked && (
                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1.5">
                    Why are you proceeding without full data?
                  </label>
                  <select
                    value={proceedReason || ''}
                    onChange={(e) => setProceedReason(e.target.value as ProceedReason || null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="">Select a reason...</option>
                    <option value="testing">Testing / Quick preview</option>
                    <option value="time_constraint">Time constraint</option>
                    <option value="data_unavailable">Data not available</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700 bg-slate-800/30 rounded-b-xl">
          {readiness.canProceedAnyway && (
            <button
              onClick={handleProceedAnyway}
              disabled={!canProceedAnyway}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                canProceedAnyway
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              Proceed Anyway
            </button>
          )}

          {primaryLabCta ? (
            <Link
              href={primaryLabCta.href}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/25 transition-all"
            >
              Run {primaryLabCta.labName}
            </Link>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DomainItemProps {
  label: string;
  status: 'critical' | 'recommended';
  labName?: string;
  labHref?: string;
  onRunLab?: () => void;
}

function DomainItem({ label, status, labName, labHref, onRunLab }: DomainItemProps) {
  const statusConfig = {
    critical: {
      bg: 'bg-red-500/10',
      iconBg: 'bg-red-500/30',
      iconText: 'text-red-400',
      textColor: 'text-red-300',
    },
    recommended: {
      bg: 'bg-amber-500/10',
      iconBg: 'bg-amber-500/20',
      iconText: 'text-amber-400',
      textColor: 'text-amber-300',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${config.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${config.iconBg}`}>
          <svg className={`w-3 h-3 ${config.iconText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        </div>
        <div>
          <p className={`text-sm font-medium ${config.textColor}`}>{label}</p>
          {labName && (
            <p className="text-xs text-slate-500">Run {labName} to populate</p>
          )}
        </div>
      </div>

      {labHref && (
        <Link
          href={labHref}
          className="text-xs px-3 py-1.5 rounded bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          Run Lab
        </Link>
      )}
    </div>
  );
}
