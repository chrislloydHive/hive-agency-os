'use client';

// components/os/strategy/HydrationDebugPanel.tsx
// Dev-only debug panel for Context → Strategy Frame hydration
//
// Shows:
// - Context load status
// - Field mapping report
// - Attempted paths and values
//
// ONLY renders in development mode

import React, { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  ExternalLink,
} from 'lucide-react';
import type { MappingReport } from '@/lib/os/strategy/contextLoader';

// ============================================================================
// Types
// ============================================================================

interface HydrationDebugPanelProps {
  companyId: string;
  contextStatus: {
    loaded: boolean;
    source: string;
    updatedAt: string | null;
    error: string | null;
  };
  mappingReport: MappingReport;
}

// ============================================================================
// Component
// ============================================================================

export function HydrationDebugPanel({
  companyId,
  contextStatus,
  mappingReport,
}: HydrationDebugPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const StatusIcon = contextStatus.loaded ? CheckCircle : XCircle;
  const statusColor = contextStatus.loaded ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="mt-4 border border-slate-700 rounded-lg bg-slate-900/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium text-amber-400">Hydration Debug</span>
          <span className="text-xs text-slate-500">(dev only)</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${statusColor}`} />
          <span className={`text-xs ${statusColor}`}>
            {contextStatus.loaded ? 'Context loaded' : 'Context not loaded'}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 border-t border-slate-700 space-y-4">
          {/* Context Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">Context Status</span>
            </div>
            <div className="bg-slate-800/50 rounded p-2 text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Loaded:</span>
                <span className={contextStatus.loaded ? 'text-emerald-400' : 'text-red-400'}>
                  {contextStatus.loaded ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Source:</span>
                <span className="text-slate-300">{contextStatus.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Updated:</span>
                <span className="text-slate-300">
                  {contextStatus.updatedAt
                    ? new Date(contextStatus.updatedAt).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
              {contextStatus.error && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Error:</span>
                  <span className="text-red-400">{contextStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mapping Report */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">Field Mapping Report</span>
              </div>
              <a
                href={`/c/${companyId}/context`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
              >
                Open Context
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="py-1 px-2">Field</th>
                    <th className="py-1 px-2">Found</th>
                    <th className="py-1 px-2">Paths Attempted</th>
                    <th className="py-1 px-2">Preview</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {mappingReport.fields.map((field) => (
                    <tr
                      key={field.field}
                      className={`border-t border-slate-700/50 ${
                        field.found ? '' : 'bg-red-500/5'
                      }`}
                    >
                      <td className="py-1.5 px-2 text-slate-300 capitalize">
                        {field.field}
                      </td>
                      <td className="py-1.5 px-2">
                        {field.found ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-slate-500 max-w-[200px] truncate">
                        {field.attemptedPaths.join(', ')}
                      </td>
                      <td className="py-1.5 px-2 text-slate-300 max-w-[150px] truncate">
                        {field.valuePreview || (
                          <span className="text-slate-500 italic">
                            {field.reason || 'Not found'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Missing Fields Summary */}
            {mappingReport.missingFields.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                <div className="text-xs">
                  <span className="text-amber-400 font-medium">Missing fields: </span>
                  <span className="text-amber-300">
                    {mappingReport.missingFields.join(', ')}
                  </span>
                  <a
                    href={`/c/${companyId}/context`}
                    className="ml-2 text-purple-400 hover:text-purple-300 underline"
                  >
                    Add in Context
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HydrationDebugPanel;
