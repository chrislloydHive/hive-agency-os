'use client';

// app/c/[companyId]/context-graph/components/RawJsonView.tsx
// Full-screen modal showing raw JSON of the context graph

import { useState } from 'react';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

interface RawJsonViewProps {
  graph: CompanyContextGraph;
  onClose: () => void;
}

export function RawJsonView({ graph, onClose }: RawJsonViewProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(graph, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `context-graph-${graph.companyId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-100">Raw JSON View</h2>
          <span className="text-sm text-slate-500">
            {graph.companyName} • {(jsonString.length / 1024).toFixed(1)} KB
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>

          <button
            onClick={onClose}
            className="ml-2 p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 top-16 overflow-auto p-6">
        <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
          {jsonString}
        </pre>
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-500">
        Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">Esc</kbd> to close
      </div>
    </div>
  );
}
