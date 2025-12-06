// components/os/AutoFillReadinessModal.tsx
// Pre-flight readiness modal for Auto-Fill (Baseline Context Build)
//
// Shows users what optional fields would improve auto-fill quality,
// while still allowing them to proceed with just domain.

'use client';

import type { ReadinessCheckResult } from '@/lib/contextGraph/readiness';

// ============================================================================
// Types
// ============================================================================

interface AutoFillReadinessModalProps {
  /** The readiness check result */
  result: ReadinessCheckResult;
  /** Company ID for navigation */
  companyId: string;
  /** Called when user clicks "Run anyway" */
  onRunAnyway: () => void;
  /** Called when modal should close */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function AutoFillReadinessModal({
  result,
  companyId,
  onRunAnyway,
  onClose,
}: AutoFillReadinessModalProps) {
  // Determine navigation path for "Add details" button
  // Navigate to setup with the step that handles the first missing field
  const getNavigationPath = () => {
    // Map missing fields to setup steps
    const firstMissing = result.missingItems[0];
    if (!firstMissing) {
      return `/c/${companyId}/brain/setup`;
    }

    // Industry and Business Model are in business-identity step
    if (firstMissing.key === 'hasIndustry' || firstMissing.key === 'hasBusinessModel') {
      return `/c/${companyId}/brain/setup?step=business-identity`;
    }

    // ICP is in audience step
    if (firstMissing.key === 'hasIcpHint') {
      return `/c/${companyId}/brain/setup?step=audience`;
    }

    // Primary offering - go to context with productOffer domain selected and predict panel open
    if (firstMissing.key === 'hasPrimaryOffering') {
      return `/c/${companyId}/brain/context?section=productOffer&panel=predict`;
    }

    return `/c/${companyId}/brain/setup`;
  };

  const handleAddDetails = () => {
    const path = getNavigationPath();
    console.log('[AutoFillReadinessModal] Navigating to:', path);
    console.log('[AutoFillReadinessModal] Missing items:', result.missingItems);
    // Use window.location for hard navigation to ensure it works
    window.location.href = path;
  };

  const handleRunAnyway = () => {
    onClose();
    onRunAnyway();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-slate-700">
          <div className="p-2.5 rounded-lg bg-amber-500/20">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Boost Auto-Fill quality?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Adding basics makes your context much better</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-300">
            We can run with just your website, but adding a few basics will make your baseline context much better.
          </p>

          {/* Checklist */}
          <div className="space-y-2">
            {/* Domain - always checked */}
            <ChecklistItem
              label="Website domain"
              hint="Required"
              isChecked={true}
              isRequired={true}
            />

            {/* Recommended items */}
            <ChecklistItem
              label="Industry"
              hint={result.readiness.hasIndustry ? 'Added' : 'What sector?'}
              isChecked={result.readiness.hasIndustry}
            />
            <ChecklistItem
              label="Business model"
              hint={result.readiness.hasBusinessModel ? 'Added' : 'SaaS, Services, eCom...'}
              isChecked={result.readiness.hasBusinessModel}
            />
            <ChecklistItem
              label="Target customers (ICP)"
              hint={result.readiness.hasIcpHint ? 'Added' : 'Who do you serve?'}
              isChecked={result.readiness.hasIcpHint}
            />
            <ChecklistItem
              label="Primary offering"
              hint={result.readiness.hasPrimaryOffering ? 'Added' : 'Main products/services'}
              isChecked={result.readiness.hasPrimaryOffering}
            />
          </div>

          {/* Missing count summary */}
          {result.missingRecommendedCount > 0 && (
            <p className="text-xs text-slate-500">
              {result.missingRecommendedCount} recommended field{result.missingRecommendedCount !== 1 ? 's' : ''} missing
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-700 bg-slate-800/30 rounded-b-xl">
          <button
            onClick={handleRunAnyway}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
          >
            Run anyway
          </button>
          <button
            onClick={handleAddDetails}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/25 transition-all"
          >
            Add details
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Checklist Item Component
// ============================================================================

interface ChecklistItemProps {
  label: string;
  hint: string;
  isChecked: boolean;
  isRequired?: boolean;
}

function ChecklistItem({ label, hint, isChecked, isRequired }: ChecklistItemProps) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
      isChecked ? 'bg-emerald-500/10' : 'bg-slate-800/50'
    }`}>
      {/* Icon */}
      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
        isChecked
          ? 'bg-emerald-500/30 text-emerald-400'
          : 'bg-amber-500/20 text-amber-400'
      }`}>
        {isChecked ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${isChecked ? 'text-emerald-300' : 'text-slate-300'}`}>
          {label}
          {isRequired && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
              Required
            </span>
          )}
        </div>
        <div className={`text-xs ${isChecked ? 'text-emerald-400/70' : 'text-slate-500'}`}>
          {hint}
        </div>
      </div>
    </div>
  );
}
