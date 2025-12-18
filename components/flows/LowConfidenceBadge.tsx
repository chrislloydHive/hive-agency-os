// components/flows/LowConfidenceBadge.tsx
// Low confidence warning badge for AI-generated outputs
//
// Displays when content was generated with missing context data.
// Shows which domains were missing at generation time.

'use client';

import { useState } from 'react';

interface LowConfidenceBadgeProps {
  missingDomains: string[];
  missingLabs?: string[];
  proceedReason?: string;
  className?: string;
  variant?: 'inline' | 'block';
}

export function LowConfidenceBadge({
  missingDomains,
  missingLabs = [],
  proceedReason,
  className = '',
  variant = 'inline',
}: LowConfidenceBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (missingDomains.length === 0) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <span
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
          bg-amber-500/20 text-amber-400 border border-amber-500/30
          cursor-help
          ${className}
        `}
        title={`Generated with missing context: ${missingDomains.join(', ')}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Low confidence
      </span>
    );
  }

  // Block variant with expandable details
  return (
    <div
      className={`
        rounded-lg border bg-amber-500/10 border-amber-500/30
        ${className}
      `}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-amber-300">
            Low confidence output
          </span>
          <span className="text-xs text-amber-400/70">
            ({missingDomains.length} missing {missingDomains.length === 1 ? 'domain' : 'domains'})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-amber-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-slate-400">
            This output was generated without complete context data. Results may be less accurate.
          </p>

          <div className="space-y-2">
            <p className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">
              Missing at generation:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missingDomains.map((domain) => (
                <span
                  key={domain}
                  className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300"
                >
                  {formatDomainName(domain)}
                </span>
              ))}
            </div>
          </div>

          {missingLabs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Suggested Labs to run:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingLabs.map((lab) => (
                  <span
                    key={lab}
                    className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300"
                  >
                    {formatLabName(lab)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {proceedReason && (
            <p className="text-xs text-slate-500">
              Proceed reason: {formatReason(proceedReason)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Inline badge for compact spaces
export function LowConfidenceBadgeInline({
  missingDomains,
  className = '',
}: {
  missingDomains: string[];
  className?: string;
}) {
  return (
    <LowConfidenceBadge
      missingDomains={missingDomains}
      className={className}
      variant="inline"
    />
  );
}

// Helper functions
function formatDomainName(domain: string): string {
  // Convert camelCase to Title Case
  return domain
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatLabName(labKey: string): string {
  // Convert lab_key to Lab Name
  return labKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (str) => str.toUpperCase());
}

function formatReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    testing: 'Testing / Quick preview',
    time_constraint: 'Time constraint',
    data_unavailable: 'Data not available',
    other: 'Other',
  };
  return reasonMap[reason] || reason;
}

// Type for generation context (to be stored with generated content)
export interface GenerationContext {
  missingDomainsAtGeneration?: string[];
  missingLabsAtGeneration?: string[];
  proceededAnywayReason?: string;
  generatedAt?: string;
}
