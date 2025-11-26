'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DiagnosticToolId, DiagnosticRunStatus } from '@/lib/os/diagnostics/runs';

interface RunDetailClientProps {
  runId: string;
  companyId: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  runStatus: DiagnosticRunStatus;
}

export function RunDetailClient({
  runId,
  companyId,
  toolId,
  toolLabel,
  runStatus,
}: RunDetailClientProps) {
  const router = useRouter();
  const [isGeneratingWork, setIsGeneratingWork] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleGenerateWorkItems = async () => {
    if (isGeneratingWork) return;
    setIsGeneratingWork(true);

    try {
      const response = await fetch(`/api/tools/${toolId}/${runId}/generate-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate work items');
      }

      showToast(`Created ${result.workItemsCreated || 0} work items!`, 'success');

      // Optionally navigate to work page
      if (result.workItemsCreated > 0) {
        setTimeout(() => {
          router.push(`/c/${companyId}/work`);
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to generate work items:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate work items', 'error');
    } finally {
      setIsGeneratingWork(false);
    }
  };

  const handleRerun = async () => {
    if (isRerunning) return;
    setIsRerunning(true);

    try {
      const response = await fetch(`/api/tools/${toolId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to run tool');
      }

      showToast(`${toolLabel} started! Redirecting...`, 'success');

      // Navigate to new run
      setTimeout(() => {
        if (result.run?.id) {
          router.push(`/c/${companyId}/diagnostics/${toolId}/${result.run.id}`);
          router.refresh();
        } else {
          router.push(`/c/${companyId}/diagnostics`);
          router.refresh();
        }
      }, 1500);
    } catch (error) {
      console.error('Failed to rerun tool:', error);
      showToast(error instanceof Error ? error.message : 'Failed to run tool', 'error');
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <>
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {runStatus === 'complete' && (
          <button
            onClick={handleGenerateWorkItems}
            disabled={isGeneratingWork}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
          >
            {isGeneratingWork ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Work Items From Findings
              </>
            )}
          </button>
        )}

        <button
          onClick={handleRerun}
          disabled={isRerunning || runStatus === 'running'}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium"
        >
          {isRerunning ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running...
            </>
          ) : runStatus === 'running' ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              In Progress...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run Again
            </>
          )}
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg ${
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
    </>
  );
}
