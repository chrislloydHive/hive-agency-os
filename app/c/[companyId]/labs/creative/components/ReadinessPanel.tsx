'use client';

// components/ReadinessPanel.tsx
// Shows readiness status and suggestions for Creative Lab

import Link from 'next/link';

interface ReadinessPanelProps {
  readiness: {
    hasICP: boolean;
    hasBrandPillars: boolean;
    hasAudienceSegments: boolean;
    hasObjectives: boolean;
    missingCritical: string[];
    canRunHighConfidence: boolean;
  };
  companyId: string;
}

export function ReadinessPanel({ readiness, companyId }: ReadinessPanelProps) {
  const checkItems = [
    { key: 'hasICP', label: 'ICP / Target Audience', required: true },
    { key: 'hasBrandPillars', label: 'Brand Positioning', required: true },
    { key: 'hasAudienceSegments', label: 'Audience Segments', required: false },
    { key: 'hasObjectives', label: 'Business Objectives', required: false },
  ];

  // If all is good, don't show the panel
  if (readiness.canRunHighConfidence && readiness.hasAudienceSegments && readiness.hasObjectives) {
    return null;
  }

  return (
    <div className="mb-6 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-3">Context Readiness</h3>
          <div className="flex flex-wrap gap-3">
            {checkItems.map(({ key, label, required }) => {
              const isReady = readiness[key as keyof typeof readiness] as boolean;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    isReady
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : required
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isReady ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {label}
                  {required && !isReady && <span className="text-red-400">*</span>}
                </div>
              );
            })}
          </div>
        </div>

        {readiness.missingCritical.length > 0 && (
          <Link
            href={`/c/${companyId}/brain/setup`}
            className="shrink-0 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            Complete Setup
          </Link>
        )}
      </div>

      {!readiness.canRunHighConfidence && (
        <p className="mt-3 text-xs text-slate-500">
          * Required for high-confidence generation. You can still generate, but results may be less accurate.
        </p>
      )}
    </div>
  );
}
