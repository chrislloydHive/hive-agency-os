'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';

// Map tool IDs to URL slugs
const toolIdToSlug: Record<DiagnosticToolId, string> = {
  gapSnapshot: 'gap-snapshot',
  gapPlan: 'gap-plan',
  gapHeavy: 'gap-heavy',
  websiteLab: 'website-lab',
  brandLab: 'brand-lab',
  contentLab: 'content-lab',
  seoLab: 'seo-lab',
  demandLab: 'demand-lab',
  opsLab: 'ops-lab',
};

// Tool labels for display
const toolLabels: Record<DiagnosticToolId, string> = {
  gapSnapshot: 'GAP Snapshot',
  gapPlan: 'GAP Plan',
  gapHeavy: 'GAP Heavy',
  websiteLab: 'Website Lab',
  brandLab: 'Brand Lab',
  contentLab: 'Content Lab',
  seoLab: 'SEO Lab',
  demandLab: 'Demand Lab',
  opsLab: 'Ops Lab',
};

interface DiagnosticsHubClientProps {
  companyId: string;
}

export function DiagnosticsHubClient({ companyId }: DiagnosticsHubClientProps) {
  const router = useRouter();
  const [runningToolId, setRunningToolId] = useState<DiagnosticToolId | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Listen for re-run button clicks via event delegation
  useEffect(() => {
    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-tool-id]') as HTMLButtonElement | null;

      if (button && button.dataset.toolId) {
        const toolId = button.dataset.toolId as DiagnosticToolId;
        await runTool(toolId);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [companyId]);

  const runTool = async (toolId: DiagnosticToolId) => {
    if (runningToolId) return;

    const toolSlug = toolIdToSlug[toolId];
    const toolLabel = toolLabels[toolId];

    setRunningToolId(toolId);
    showToast(`Starting ${toolLabel}...`, 'info');

    try {
      // Use the unified tools API
      const response = await fetch(`/api/tools/${toolSlug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run diagnostic');
      }

      // Check if we got a run ID back
      const runId = result.run?.id;

      if (runId && result.result?.success) {
        showToast(`${toolLabel} completed! Viewing results...`, 'success');
        // Navigate to the run detail page
        setTimeout(() => {
          router.push(`/c/${companyId}/diagnostics/${toolSlug}/${runId}`);
        }, 1000);
      } else if (runId) {
        showToast(`${toolLabel} started. Check back soon.`, 'info');
        // Refresh to show updated data
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        showToast(`${toolLabel} completed! Refreshing...`, 'success');
        setTimeout(() => {
          router.refresh();
        }, 1000);
      }
    } catch (error) {
      console.error(`Error running ${toolId}:`, error);
      showToast(
        error instanceof Error ? error.message : 'Failed to run diagnostic',
        'error'
      );
    } finally {
      setRunningToolId(null);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-100'
              : toast.type === 'info'
                ? 'bg-blue-900/90 border border-blue-700 text-blue-100'
                : 'bg-red-900/90 border border-red-700 text-red-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : toast.type === 'info' ? (
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Loading overlay when running */}
      {runningToolId && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-slate-200 font-medium">
                Running {toolLabels[runningToolId]}...
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400 text-center">
              This may take a few moments
            </p>
          </div>
        </div>
      )}
    </>
  );
}
