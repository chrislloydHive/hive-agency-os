'use client';

// components/context/DiagnosticsDebugDrawer.tsx
// Diagnostics Debug Drawer
//
// Collapsible panel showing diagnostic debug info for troubleshooting.
// Only visible in development or when NEXT_PUBLIC_SHOW_DEBUG=true.

import { useState } from 'react';
import { ChevronDown, ChevronRight, Bug, Copy, Check, AlertCircle } from 'lucide-react';
import type { DiagnosticsDebugInfo } from '@/lib/os/diagnostics/debugInfo';

// ============================================================================
// Types
// ============================================================================

interface DiagnosticsDebugDrawerProps {
  debugInfo: DiagnosticsDebugInfo;
}

// ============================================================================
// Component
// ============================================================================

export function DiagnosticsDebugDrawer({ debugInfo }: DiagnosticsDebugDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Don't render if gating conditions aren't met
  const showDebug =
    process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!showDebug) {
    return null;
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="mt-6">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <Bug className="w-3.5 h-3.5" />
        <span>Debug</span>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-3 p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
          {/* Error Banner */}
          {debugInfo.error && (
            <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-center gap-2 text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{debugInfo.error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Baseline Signals Section */}
            {debugInfo.baselineSignals && (
              <DebugSection title="Baseline Signals">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DebugRow
                    label="Lab Runs"
                    value={debugInfo.baselineSignals.hasLabRuns ? '✓' : '✗'}
                    valueClass={debugInfo.baselineSignals.hasLabRuns ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  <DebugRow
                    label="Full GAP"
                    value={debugInfo.baselineSignals.hasFullGap ? '✓' : '✗'}
                    valueClass={debugInfo.baselineSignals.hasFullGap ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  <DebugRow
                    label="Competition"
                    value={debugInfo.baselineSignals.hasCompetition ? '✓' : '✗'}
                    valueClass={debugInfo.baselineSignals.hasCompetition ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  <DebugRow
                    label="Website Meta"
                    value={debugInfo.baselineSignals.hasWebsiteMetadata ? '✓' : '✗'}
                    valueClass={debugInfo.baselineSignals.hasWebsiteMetadata ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  <DebugRow
                    label="Findings"
                    value={String(debugInfo.baselineSignals.findingsCount)}
                  />
                  <DebugRow
                    label="Competitors"
                    value={String(debugInfo.baselineSignals.competitorCount)}
                  />
                </div>
                {debugInfo.baselineSignals.signalSources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800">
                    <span className="text-slate-500">Sources: </span>
                    <span className="text-slate-300">
                      {debugInfo.baselineSignals.signalSources.join(', ')}
                    </span>
                  </div>
                )}
              </DebugSection>
            )}

            {/* Competition Run Section */}
            {debugInfo.competitionRunId && (
              <DebugSection title="Competition Run">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Run ID:</span>
                    <code className="text-cyan-400 text-[10px]">
                      {debugInfo.competitionRunId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(debugInfo.competitionRunId!, 'runId')}
                      className="p-0.5 text-slate-500 hover:text-slate-300"
                      title="Copy Run ID"
                    >
                      {copiedId === 'runId' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <DebugRow
                    label="Status"
                    value={debugInfo.competitionStatus || '—'}
                    valueClass={
                      debugInfo.competitionStatus === 'completed'
                        ? 'text-emerald-400'
                        : debugInfo.competitionStatus === 'failed'
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }
                  />
                  <DebugRow label="Started" value={formatDate(debugInfo.competitionStartedAt)} />
                  <DebugRow label="Completed" value={formatDate(debugInfo.competitionCompletedAt)} />
                </div>
              </DebugSection>
            )}

            {/* Summary Section */}
            {debugInfo.summary && (
              <DebugSection title="Summary">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <DebugRow
                    label="Candidates"
                    value={String(debugInfo.summary.totalCandidates)}
                  />
                  <DebugRow
                    label="Final"
                    value={String(debugInfo.summary.totalCompetitors)}
                  />
                  <DebugRow
                    label="Avg Threat"
                    value={`${debugInfo.summary.avgThreatScore.toFixed(1)}`}
                  />
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-500">By Type: </span>
                  <span className="text-slate-300">
                    {Object.entries(debugInfo.summary.byType)
                      .filter(([, count]) => count > 0)
                      .map(([type, count]) => `${type}: ${count}`)
                      .join(', ') || '—'}
                  </span>
                </div>
              </DebugSection>
            )}

            {/* Classification Section */}
            {debugInfo.classification && (
              <DebugSection title="Classification">
                <div className="space-y-1">
                  <DebugRow
                    label="Archetype"
                    value={debugInfo.classification.archetype || '—'}
                  />
                  <DebugRow
                    label="Vertical"
                    value={debugInfo.classification.vertical || '—'}
                  />
                  {debugInfo.classification.marketplaceVertical && (
                    <DebugRow
                      label="Marketplace"
                      value={debugInfo.classification.marketplaceVertical}
                    />
                  )}
                  {debugInfo.classification.confidence !== undefined && (
                    <DebugRow
                      label="Confidence"
                      value={`${(debugInfo.classification.confidence * 100).toFixed(0)}%`}
                    />
                  )}
                </div>
              </DebugSection>
            )}

            {/* Top Competitors Section */}
            {debugInfo.topCompetitors && debugInfo.topCompetitors.length > 0 && (
              <DebugSection title={`Top Competitors (${debugInfo.topCompetitors.length})`}>
                <div className="space-y-2">
                  {debugInfo.topCompetitors.map((c, i) => (
                    <div
                      key={c.domain}
                      className="flex items-start gap-2 py-1 border-b border-slate-800/50 last:border-0"
                    >
                      <span className="text-slate-600 w-4">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 truncate">{c.domain}</span>
                          {c.type && (
                            <span
                              className={`px-1 py-0.5 rounded text-[9px] ${
                                c.type === 'direct'
                                  ? 'bg-red-500/20 text-red-400'
                                  : c.type === 'partial'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : c.type === 'platform'
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-slate-500/20 text-slate-400'
                              }`}
                            >
                              {c.type}
                            </span>
                          )}
                          {c.threatScore !== undefined && (
                            <span className="text-slate-500">
                              threat: {c.threatScore.toFixed(0)}
                            </span>
                          )}
                        </div>
                        {c.name && c.name !== c.domain && (
                          <div className="text-slate-500 text-[10px] truncate">{c.name}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </DebugSection>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DebugRow({
  label,
  value,
  valueClass = 'text-slate-300',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">{label}:</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
