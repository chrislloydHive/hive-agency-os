// components/context/StrategyBindingsDebugPanel.tsx
// Debug Panel for Strategy ↔ Context Bindings (Dev Only)
//
// Shows:
// - All bindings with their resolved values
// - Status (confirmed/proposed/missing)
// - Source provenance
// - Readiness computation
//
// Only visible in development mode via toggle.

'use client';

import { useState, useMemo } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useContextNodes, type ResolvedBinding } from '@/hooks/useContextNodes';

// ============================================================================
// Types
// ============================================================================

interface StrategyBindingsDebugPanelProps {
  companyId: string;
}

// ============================================================================
// Component
// ============================================================================

export function StrategyBindingsDebugPanel({ companyId }: StrategyBindingsDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Check if in development mode
  const isDev = process.env.NODE_ENV === 'development';

  // Hooks must be called unconditionally, before any early returns
  // Pass null companyId when not in dev to skip the fetch
  const { data, error, isLoading, isValidating, mutate } = useContextNodes(isDev ? companyId : null);

  // Group bindings by section
  const groupedBindings = useMemo(() => {
    if (!data?.resolvedBindings) return {};

    const groups: Record<string, typeof data.resolvedBindings> = {};
    for (const rb of data.resolvedBindings) {
      const section = rb.binding.section || 'other';
      if (!groups[section]) groups[section] = [];
      groups[section].push(rb);
    }
    return groups;
  }, [data?.resolvedBindings]);

  // Only render in development
  if (!isDev) {
    return null;
  }

  // Copy debug data to clipboard
  const handleCopyDebug = () => {
    if (!data) return;
    const debugData = {
      companyId,
      timestamp: data.timestamp,
      readiness: data.readiness,
      recommendedNext: data.recommendedNext,
      bindings: data.resolvedBindings.map(rb => ({
        strategyInputId: rb.binding.strategyInputId,
        contextKey: rb.binding.contextKey,
        value: rb.value,
        status: rb.status,
        source: rb.source,
        confidence: rb.confidence,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg transition-colors"
        title="Toggle Bindings Debug Panel"
      >
        <Bug className="w-5 h-5 text-white" />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-[500px] max-h-[80vh] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-medium text-slate-200">
                Strategy ↔ Context Bindings
              </h3>
              {isValidating && (
                <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyDebug}
                className="p-1.5 text-slate-400 hover:text-slate-300 transition-colors"
                title="Copy debug data"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => mutate()}
                className="p-1.5 text-slate-400 hover:text-slate-300 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-400"
              >
                Close
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            ) : error ? (
              <div className="p-4 text-center text-red-400">
                Error: {error.message}
              </div>
            ) : data ? (
              <div className="divide-y divide-slate-800">
                {/* Readiness Summary */}
                <div className="p-4">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Readiness
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Score:</span>
                      <span className={`font-mono ${
                        data.readiness.readinessPercent >= 75 ? 'text-emerald-400' :
                        data.readiness.readinessPercent >= 50 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {data.readiness.readinessPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Can Synthesize:</span>
                      <span className={data.readiness.canSynthesize ? 'text-emerald-400' : 'text-red-400'}>
                        {data.readiness.canSynthesize ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Confirmed:</span>
                      <span className="text-emerald-400 font-mono">
                        {data.readiness.confirmedRequiredCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Proposed:</span>
                      <span className="text-amber-400 font-mono">
                        {data.readiness.proposedRequiredCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Missing:</span>
                      <span className="text-red-400 font-mono">
                        {data.readiness.missingRequiredCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Required:</span>
                      <span className="text-slate-300 font-mono">
                        {data.readiness.totalRequiredCount}
                      </span>
                    </div>
                  </div>
                  {data.readiness.synthesizeBlockReason && (
                    <p className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                      {data.readiness.synthesizeBlockReason}
                    </p>
                  )}
                </div>

                {/* Recommended Next */}
                {data.recommendedNext && (
                  <div className="p-4">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                      Recommended Next
                    </h4>
                    <div className="text-sm">
                      <p className="text-cyan-400">
                        {data.recommendedNext.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        {data.recommendedNext.contextKey}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bindings by Section */}
                {Object.entries(groupedBindings).map(([section, bindings]) => (
                  <div key={section} className="border-t border-slate-800">
                    <button
                      onClick={() => setExpandedSection(
                        expandedSection === section ? null : section
                      )}
                      className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-300 capitalize">
                          {section}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({bindings.length} bindings)
                        </span>
                      </div>
                      {expandedSection === section ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    {expandedSection === section && (
                      <div className="px-4 pb-3 space-y-2">
                        {bindings.map((rb) => (
                          <BindingRow key={rb.binding.contextKey} binding={rb} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Timestamp */}
                <div className="p-4 text-xs text-slate-600">
                  Last updated: {new Date(data.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BindingRow({ binding }: { binding: ResolvedBinding }) {
  const [showValue, setShowValue] = useState(false);

  const StatusIcon = binding.status === 'confirmed'
    ? CheckCircle
    : binding.status === 'proposed'
    ? Clock
    : AlertCircle;

  const statusColor = binding.status === 'confirmed'
    ? 'text-emerald-400'
    : binding.status === 'proposed'
    ? 'text-amber-400'
    : 'text-red-400';

  // Format value for display
  const formattedValue = useMemo(() => {
    const value = binding.value;
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return `"${value.slice(0, 100)}${value.length > 100 ? '...' : ''}"`;
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 100);
    return String(value);
  }, [binding.value]);

  return (
    <div className="bg-slate-800/50 rounded-lg p-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-3 h-3 ${statusColor}`} />
          <span className="text-slate-300 font-medium">
            {binding.binding.shortLabel || binding.binding.label}
          </span>
          {binding.binding.required && (
            <span className="px-1 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded">
              required
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {binding.source && (
            <span className="px-1 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
              {binding.source}
            </span>
          )}
          {binding.confidence !== null && (
            <span className="px-1 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
              {Math.round(binding.confidence * 100)}%
            </span>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-slate-500 font-mono text-[10px] flex-shrink-0">
          {binding.binding.contextKey}
        </span>
        <button
          onClick={() => setShowValue(!showValue)}
          className="text-slate-600 hover:text-slate-400"
        >
          {showValue ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      {showValue && (
        <div className="mt-2 p-2 bg-slate-900 rounded font-mono text-[10px] text-slate-400 break-all">
          {formattedValue}
        </div>
      )}
    </div>
  );
}

export default StrategyBindingsDebugPanel;
