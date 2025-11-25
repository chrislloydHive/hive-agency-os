'use client';

import { useState } from 'react';
import type { DiagnosticModuleKey } from '@/lib/gap-heavy/types';

interface DiagnosticsControlsProps {
  companyId: string;
}

export function DiagnosticsControls({ companyId }: DiagnosticsControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runningModule, setRunningModule] = useState<DiagnosticModuleKey | 'all' | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const runDiagnostics = async (modules?: DiagnosticModuleKey[]) => {
    const moduleLabel = modules ? modules.join(', ') : 'all';
    setIsRunning(true);
    setRunningModule(modules ? modules[0] : 'all');
    showToast(`Starting diagnostics run (${moduleLabel})...`, 'success');

    try {
      const response = await fetch('/api/os/diagnostics/run-heavy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          modules,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to run diagnostics');
      }

      showToast(
        `Diagnostics completed! Run ID: ${result.runId.slice(-6)}`,
        'success'
      );

      // Refresh the page to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to run diagnostics',
        'error'
      );
    } finally {
      setIsRunning(false);
      setRunningModule(null);
    }
  };

  const handleRunFull = () => {
    runDiagnostics();
  };

  const handleRunModule = (module: DiagnosticModuleKey) => {
    runDiagnostics([module]);
  };

  return (
    <div className="space-y-4">
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

      {/* Primary "Run Full Diagnostics" Button */}
      <button
        onClick={handleRunFull}
        disabled={isRunning}
        className={`w-full rounded-xl px-6 py-3 font-semibold text-sm transition-all ${
          isRunning && runningModule === 'all'
            ? 'bg-emerald-600 text-white cursor-wait'
            : isRunning
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {isRunning && runningModule === 'all' ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
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
            Running Full Diagnostics...
          </span>
        ) : (
          'Run Full Diagnostics'
        )}
      </button>

      {/* Module-Specific Run Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <ModuleRunButton
          module="brand"
          label="Brand"
          isRunning={isRunning && runningModule === 'brand'}
          isDisabled={isRunning}
          onClick={() => handleRunModule('brand')}
        />
        <ModuleRunButton
          module="seo"
          label="SEO"
          isRunning={isRunning && runningModule === 'seo'}
          isDisabled={isRunning}
          onClick={() => handleRunModule('seo')}
        />
        <ModuleRunButton
          module="content"
          label="Content"
          isRunning={isRunning && runningModule === 'content'}
          isDisabled={isRunning}
          onClick={() => handleRunModule('content')}
        />
        <ModuleRunButton
          module="website"
          label="Website"
          isRunning={isRunning && runningModule === 'website'}
          isDisabled={isRunning}
          onClick={() => handleRunModule('website')}
        />
        <ModuleRunButton
          module="demand"
          label="Demand"
          isRunning={isRunning && runningModule === 'demand'}
          isDisabled={isRunning}
          onClick={() => handleRunModule('demand')}
        />
      </div>
    </div>
  );
}

interface ModuleRunButtonProps {
  module: DiagnosticModuleKey;
  label: string;
  isRunning: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

function ModuleRunButton({
  module,
  label,
  isRunning,
  isDisabled,
  onClick,
}: ModuleRunButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
        isRunning
          ? 'bg-slate-700 text-slate-200'
          : isDisabled
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
      }`}
    >
      {isRunning ? (
        <span className="flex items-center justify-center gap-1.5">
          <svg
            className="animate-spin h-3 w-3"
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
          Running...
        </span>
      ) : (
        `Run ${label} Only`
      )}
    </button>
  );
}
