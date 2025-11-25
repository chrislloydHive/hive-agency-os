'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DiagnosticToolId } from '@/lib/os/diagnostics/runs';

interface DiagnosticsHubClientProps {
  companyId: string;
}

export function DiagnosticsHubClient({ companyId }: DiagnosticsHubClientProps) {
  const router = useRouter();
  const [runningToolId, setRunningToolId] = useState<DiagnosticToolId | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
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

    setRunningToolId(toolId);
    showToast(`Starting ${toolId} diagnostic...`, 'success');

    try {
      // Use the generic diagnostic run API
      const response = await fetch(`/api/os/diagnostics/run/${toolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run diagnostic');
      }

      showToast(`${toolId} completed! Refreshing...`, 'success');

      // Refresh to show updated data
      setTimeout(() => {
        router.refresh();
      }, 1000);
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
                className="animate-spin h-5 w-5 text-emerald-400"
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
                Running {runningToolId} diagnostic...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
