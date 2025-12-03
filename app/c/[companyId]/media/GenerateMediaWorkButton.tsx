// app/c/[companyId]/media/GenerateMediaWorkButton.tsx
// Client component for generating Work items from Media scorecards
'use client';

import { useState } from 'react';

interface GenerateMediaWorkButtonProps {
  companyId: string;
  companyName: string;
}

export function GenerateMediaWorkButton({ companyId, companyName }: GenerateMediaWorkButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    draftsCount?: number;
    createdCount?: number;
  } | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/media/work`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thresholds: {
            visibility: 50,
            demand: 50,
            conversion: 50,
          },
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setResult({
          success: true,
          message: data.result.draftsCount === 0
            ? 'All stores are performing well - no work items needed!'
            : `Created ${data.result.createdCount} work items from ${data.result.draftsCount} identified issues`,
          draftsCount: data.result.draftsCount,
          createdCount: data.result.createdCount,
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to generate work items',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'An error occurred while generating work items',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg ${
            result.success
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {result.message}
        </div>
      )}
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title={`Generate work items for ${companyName} based on store scorecard performance`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            Generate Work Items
          </>
        )}
      </button>
    </div>
  );
}
