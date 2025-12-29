'use client';

// app/c/[companyId]/context/ContextGraphViewer.tsx
// Company Context Graph Viewer - Client Component (Phase 3)
//
// Rich UI with:
// - Domain sidebar with counts and issue indicators
// - Enhanced field cards with provenance modal
// - Global search across all domains
// - Context health summary with AI consistency check
// - Snapshot timeline with comparison
// - Domain summary panel
// - Analyst notes
// - Phase 3: Inline editing, lock management, AI suggestions
// - Phase 3: Validation panel, contract status, update log
// - Phase 3: Auto-healing modal

import { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { DOMAIN_NAMES } from '@/lib/contextGraph/companyContextGraph';
import type {
  GraphFieldUi,
  GraphDiffItem,
  ContextDomainId,
} from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import type { ContextGraphSnapshot } from '@/lib/contextGraph/history';
import type { NeedsRefreshFlag } from '@/lib/contextGraph/contextHealth';
import type { FieldLock } from '@/lib/contextGraph/governance/locks';
import type { ValidationIssue } from '@/lib/contextGraph/governance/rules';
import type { GraphContractStatus } from '@/lib/contextGraph/governance/contracts';
import type { UpdateLogEntry } from '@/lib/contextGraph/governance/updateLog';
import type { AISuggestion } from '@/lib/contextGraph/inference/aiSuggest';
import type { HealingReport } from '@/lib/contextGraph/inference/aiHeal';

// Import Phase 2 components
import { ProvenanceModal } from './components/ProvenanceModal';
import { FieldCard } from './components/FieldCard';
import { DomainSummaryPanel } from './components/DomainSummaryPanel';
import { SnapshotComparePanel } from './components/SnapshotComparePanel';
import { NotesPanel } from './components/NotesPanel';
import { AIConsistencyPanel } from './components/AIConsistencyPanel';

// Import Phase 3 components
import { SuggestionPanel } from './components/SuggestionPanel';
import { ContractPanel } from './components/ContractPanel';
import { UpdateLogPanel } from './components/UpdateLogPanel';
import { HealingModal } from './components/HealingModal';

// Import Phase 4 components
import {
  CollaborationPanel,
  IntentPanel,
  PredictivePanel,
  TemporalPanel,
  BenchmarksPanel,
} from '@/components/os/context';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
  graph: CompanyContextGraph | null;
  fields: GraphFieldUi[];
  needsRefresh: NeedsRefreshFlag[];
  contextHealthScore: number;
  snapshots: ContextGraphSnapshot[];
  diff: GraphDiffItem[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Main Viewer Component
// ============================================================================

export function ContextGraphViewer({
  companyId,
  companyName,
  graph,
  fields,
  needsRefresh,
  contextHealthScore,
  snapshots,
  diff,
}: Props) {
  const [selectedDomain, setSelectedDomain] = useState<ContextDomainId>('identity');
  const [showOnlyWithValue, setShowOnlyWithValue] = useState(false);
  const [showOnlyRefreshIssues, setShowOnlyRefreshIssues] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'snapshots' | 'notes' | 'ai' | 'suggestions' | 'validation' | 'contracts' | 'logs' | 'predict' | 'temporal' | 'collab' | 'bench'>('snapshots');

  // Provenance modal state
  const [provenanceModalField, setProvenanceModalField] = useState<GraphFieldUi | null>(null);

  // Explain field modal state (using ExplainFieldButton inline)
  const [explainField, setExplainField] = useState<GraphFieldUi | null>(null);

  // Phase 3: Locks state
  const [locks, setLocks] = useState<Map<string, FieldLock>>(new Map());
  const [_locksLoading, setLocksLoading] = useState(false);

  // Phase 3: Validation state
  const [_validationIssues, _setValidationIssues] = useState<ValidationIssue[]>([]);
  const [_validationLoading, _setValidationLoading] = useState(false);

  // Phase 3: Contract status state
  const [contractStatus, _setContractStatus] = useState<GraphContractStatus | null>(null);

  // Phase 3: AI Suggestions state
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Phase 3: Update Log state
  const [updateLogs, setUpdateLogs] = useState<UpdateLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Phase 3: Healing modal state
  const [showHealingModal, setShowHealingModal] = useState(false);
  const [healingReport, setHealingReport] = useState<HealingReport | null>(null);
  const [healingLoading, setHealingLoading] = useState(false);

  // Load locks on mount
  useEffect(() => {
    async function loadLocks() {
      setLocksLoading(true);
      try {
        const response = await fetch(`/api/context/locks?companyId=${companyId}`);
        if (response.ok) {
          const data = await response.json();
          const lockMap = new Map<string, FieldLock>();
          for (const lock of data.locks ?? []) {
            lockMap.set(lock.path, lock);
          }
          setLocks(lockMap);
        }
      } catch (error) {
        console.error('Failed to load locks:', error);
      } finally {
        setLocksLoading(false);
      }
    }
    loadLocks();
  }, [companyId]);

  // Load update logs on mount
  useEffect(() => {
    async function loadLogs() {
      setLogsLoading(true);
      try {
        const response = await fetch(`/api/context/updates?companyId=${companyId}&type=recent&limit=50`);
        if (response.ok) {
          const data = await response.json();
          setUpdateLogs(data.logs ?? []);
        }
      } catch (error) {
        console.error('Failed to load logs:', error);
      } finally {
        setLogsLoading(false);
      }
    }
    loadLogs();
  }, [companyId]);

  // Group fields by domain
  const fieldsByDomain = useMemo(() => {
    const map = new Map<ContextDomainId, GraphFieldUi[]>();
    DOMAIN_NAMES.forEach((d) => map.set(d, []));
    fields.forEach((f) => {
      const arr = map.get(f.domain);
      if (arr) arr.push(f);
    });
    map.forEach((arr) => arr.sort((a, b) => a.label.localeCompare(b.label)));
    return map;
  }, [fields]);

  // Create a set of paths that need refresh for fast lookup
  const needsRefreshByPath = useMemo(() => {
    const map = new Map<string, NeedsRefreshFlag>();
    needsRefresh.forEach((f) => {
      const path = `${f.domain}.${f.field}`;
      map.set(path, f);
    });
    return map;
  }, [needsRefresh]);

  // Get issues for current domain
  const domainIssues = useMemo(() => {
    return needsRefresh.filter(n => n.domain === selectedDomain);
  }, [needsRefresh, selectedDomain]);

  // Global search results across all domains
  const globalSearchResults = useMemo(() => {
    if (!globalSearchTerm.trim()) return [];

    const term = globalSearchTerm.toLowerCase();
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(term) ||
        f.path.toLowerCase().includes(term) ||
        (f.value ?? '').toLowerCase().includes(term)
    );
  }, [fields, globalSearchTerm]);

  // Filter fields based on current filters
  const filteredFields = useMemo(() => {
    // If global search is active, show results from all domains
    if (isGlobalSearch && globalSearchTerm.trim()) {
      return globalSearchResults;
    }

    let domainFields = fieldsByDomain.get(selectedDomain) ?? [];

    if (showOnlyWithValue) {
      domainFields = domainFields.filter((f) => f.value !== null && f.value !== '');
    }

    if (showOnlyRefreshIssues) {
      domainFields = domainFields.filter((f) => needsRefreshByPath.has(f.path));
    }

    return domainFields;
  }, [fieldsByDomain, selectedDomain, showOnlyWithValue, showOnlyRefreshIssues, isGlobalSearch, globalSearchTerm, globalSearchResults, needsRefreshByPath]);

  const domainMeta = CONTEXT_DOMAIN_META[selectedDomain];

  // Handlers
  const handleOpenProvenance = useCallback((field: GraphFieldUi) => {
    setProvenanceModalField(field);
  }, []);

  const handleExplainField = useCallback((field: GraphFieldUi) => {
    setExplainField(field);
  }, []);

  const handleGlobalSearchChange = (value: string) => {
    setGlobalSearchTerm(value);
    if (value.trim()) {
      setIsGlobalSearch(true);
    }
  };

  const clearGlobalSearch = () => {
    setGlobalSearchTerm('');
    setIsGlobalSearch(false);
  };

  // Phase 3: Field save handler
  const handleSaveField = useCallback(async (path: string, newValue: string) => {
    try {
      const response = await fetch('/api/context/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path,
          value: newValue,
          updatedBy: 'human',
          createSnapshot: true,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Reload the page to show updated data
        window.location.reload();
        return { success: true };
      } else {
        return { success: false, error: data.blockedReason || data.error || 'Failed to save' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save' };
    }
  }, [companyId]);

  // Phase 3: Lock handlers
  const handleLockField = useCallback(async (path: string) => {
    try {
      const response = await fetch('/api/context/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path,
          lockedBy: 'user', // TODO: Get actual user ID
          severity: 'soft',
          reason: 'Locked via UI',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.lock) {
          setLocks(prev => new Map([...prev, [path, data.lock]]));
        }
      }
    } catch (error) {
      console.error('Failed to lock field:', error);
    }
  }, [companyId]);

  const handleUnlockField = useCallback(async (path: string) => {
    try {
      const response = await fetch(`/api/context/locks?companyId=${companyId}&path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLocks(prev => {
          const next = new Map(prev);
          next.delete(path);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to unlock field:', error);
    }
  }, [companyId]);

  // Phase 3: AI Suggestions handlers
  const handleLoadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const response = await fetch('/api/context/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          options: { maxSuggestions: 20 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [companyId]);

  const handleAcceptSuggestion = useCallback(async (suggestion: AISuggestion) => {
    try {
      const response = await fetch('/api/context/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path: suggestion.path,
          value: suggestion.suggestedValue,
          updatedBy: 'human',
          reasoning: `Accepted AI suggestion: ${suggestion.reasoning}`,
          createSnapshot: true,
        }),
      });

      if (response.ok) {
        // Remove from suggestions list
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        // Reload to show updated data
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  }, [companyId]);

  const handleRejectSuggestion = useCallback(async (suggestion: AISuggestion) => {
    // Just remove from UI for now
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  // Phase 3: Healing handlers
  const handleOpenHealing = useCallback(async () => {
    setShowHealingModal(true);
    setHealingLoading(true);

    try {
      const response = await fetch('/api/context/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      if (response.ok) {
        const data = await response.json();
        setHealingReport(data);
      }
    } catch (error) {
      console.error('Failed to load healing report:', error);
    } finally {
      setHealingLoading(false);
    }
  }, [companyId]);

  const handleAcceptHealingFix = useCallback(async (fix: { path: string; newValue: unknown; reasoning: string }) => {
    await handleSaveField(fix.path, typeof fix.newValue === 'string' ? fix.newValue : JSON.stringify(fix.newValue));
  }, [handleSaveField]);

  const handleAcceptAllHealing = useCallback(async () => {
    if (!healingReport?.fixes) return;

    for (const fix of healingReport.fixes) {
      await handleAcceptHealingFix(fix);
    }
  }, [healingReport, handleAcceptHealingFix]);

  // Empty state when no graph exists
  if (!graph) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <Header companyId={companyId} companyName={companyName} />
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">No Context Graph</h2>
            <p className="text-sm text-slate-400 mb-6">
              Run diagnostics or trigger fusion to build the company's context graph.
            </p>
            <Link
              href={`/c/${companyId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors"
            >
              Back to Company
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-900 bg-slate-950/80 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-900">
          <Link
            href={`/c/${companyId}`}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← {companyName}
          </Link>
          <h1 className="mt-2 text-sm font-semibold text-slate-100">Context Graph</h1>
          <p className="mt-1 text-xs text-slate-500">
            Unified memory for AI strategy & execution.
          </p>
        </div>

        {/* Global Search */}
        <div className="p-4 border-b border-slate-900">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search all fields..."
              value={globalSearchTerm}
              onChange={(e) => handleGlobalSearchChange(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            />
            {globalSearchTerm && (
              <button
                onClick={clearGlobalSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {isGlobalSearch && globalSearchTerm && (
            <div className="mt-2 text-[11px] text-amber-400">
              {globalSearchResults.length} result{globalSearchResults.length !== 1 ? 's' : ''} across all domains
            </div>
          )}
        </div>

        {/* Context Health */}
        <div className="p-4 border-b border-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">Context Health</span>
            <span
              className={cn(
                'text-sm font-semibold',
                contextHealthScore >= 75 && 'text-emerald-400',
                contextHealthScore >= 50 && contextHealthScore < 75 && 'text-amber-400',
                contextHealthScore < 50 && 'text-red-400'
              )}
            >
              {contextHealthScore}%
            </span>
          </div>
          {needsRefresh.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-500">
              {needsRefresh.length} field{needsRefresh.length > 1 ? 's' : ''} need attention.
            </p>
          )}
        </div>

        {/* Domain Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {DOMAIN_NAMES.map((domainId) => {
            const meta = CONTEXT_DOMAIN_META[domainId];
            const domainFields = fieldsByDomain.get(domainId) ?? [];
            const populatedCount = domainFields.filter((f) => f.value !== null && f.value !== '').length;
            const hasIssues = domainFields.some((f) => needsRefreshByPath.has(f.path));
            const hasLocks = domainFields.some((f) => locks.has(f.path));

            return (
              <button
                key={domainId}
                type="button"
                onClick={() => {
                  setSelectedDomain(domainId);
                  setIsGlobalSearch(false);
                  setGlobalSearchTerm('');
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                  selectedDomain === domainId && !isGlobalSearch
                    ? 'bg-slate-900 text-slate-50'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-100'
                )}
              >
                <span className="truncate">{meta.label}</span>
                <span className="flex items-center gap-1.5">
                  {hasLocks && (
                    <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {hasIssues && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  <span className="text-[10px] text-slate-500">
                    {populatedCount}/{domainFields.length}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Phase 4: Intent Panel in sidebar */}
        <div className="p-4 border-t border-slate-900">
          <IntentPanel
            companyId={companyId}
            currentDomain={selectedDomain}
          />
        </div>

        {/* Sidebar Actions */}
        <div className="p-4 border-t border-slate-900 space-y-2">
          {/* Auto-Heal Button */}
          <button
            onClick={handleOpenHealing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-300 transition-colors border border-amber-500/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-Heal Graph
          </button>

          {/* Rebuild Button */}
          <RebuildButton companyId={companyId} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-900 bg-slate-950/80 px-6 py-3">
          <div>
            {isGlobalSearch ? (
              <>
                <div className="text-xs uppercase tracking-wide text-amber-400">
                  Global Search Results
                </div>
                <div className="text-sm text-slate-300">
                  Showing {globalSearchResults.length} matches for "{globalSearchTerm}"
                </div>
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {CONTEXT_DOMAIN_META[selectedDomain].label}
                </div>
                {domainMeta.description && (
                  <div className="text-sm text-slate-300">{domainMeta.description}</div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Filters (only when not in global search) */}
            {!isGlobalSearch && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyWithValue}
                    onChange={(e) => setShowOnlyWithValue(e.target.checked)}
                    className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                  />
                  With values
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyRefreshIssues}
                    onChange={(e) => setShowOnlyRefreshIssues(e.target.checked)}
                    className="h-3 w-3 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                  />
                  Needs refresh
                </label>
              </div>
            )}

            {/* Lab Link (only when not in global search) */}
            {!isGlobalSearch && domainMeta.labLink && domainMeta.labLink(companyId) && (
              <Link
                href={domainMeta.labLink(companyId)!}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-amber-400 hover:text-amber-300 transition-colors"
              >
                Open {domainMeta.label} Lab
              </Link>
            )}
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Fields List */}
          <section className="flex-1 overflow-y-auto p-6 space-y-3">
            {/* Domain Summary (only when viewing a domain, not global search) */}
            {!isGlobalSearch && (
              <DomainSummaryPanel
                domainId={selectedDomain}
                fields={fieldsByDomain.get(selectedDomain) ?? []}
                issues={domainIssues}
                companyId={companyId}
              />
            )}

            {/* Fields */}
            {filteredFields.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center">
                <p className="text-xs text-slate-500">
                  {isGlobalSearch
                    ? 'No fields match your search.'
                    : showOnlyWithValue || showOnlyRefreshIssues
                      ? 'No fields match the current filters.'
                      : 'No fields in this domain.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFields.map((field) => (
                  <FieldCard
                    key={field.path}
                    field={field}
                    issue={needsRefreshByPath.get(field.path)}
                    companyId={companyId}
                    lock={locks.get(field.path)}
                    onOpenProvenance={handleOpenProvenance}
                    onExplainField={handleExplainField}
                    onSave={handleSaveField}
                    onLock={handleLockField}
                    onUnlock={handleUnlockField}
                    canEdit={true}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right Panel */}
          <aside className="w-96 border-l border-slate-900 bg-slate-950/80 flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-900 overflow-x-auto">
              {[
                { id: 'snapshots', label: 'History' },
                { id: 'suggestions', label: 'AI' },
                { id: 'predict', label: 'Predict' },
                { id: 'temporal', label: 'Timeline' },
                { id: 'collab', label: 'Collab' },
                { id: 'bench', label: 'Bench' },
                { id: 'validation', label: 'Rules' },
                { id: 'logs', label: 'Log' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightPanelTab(tab.id as typeof rightPanelTab)}
                  className={cn(
                    'flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors',
                    rightPanelTab === tab.id
                      ? 'text-amber-300 border-b-2 border-amber-400'
                      : 'text-slate-500 hover:text-slate-300'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {rightPanelTab === 'snapshots' && (
                <SnapshotComparePanel
                  versions={snapshots}
                  currentDiff={diff}
                  companyId={companyId}
                />
              )}

              {rightPanelTab === 'notes' && (
                <NotesPanel
                  companyId={companyId}
                  domainId={selectedDomain}
                />
              )}

              {rightPanelTab === 'suggestions' && (
                <SuggestionPanel
                  companyId={companyId}
                  suggestions={suggestions}
                  onAccept={handleAcceptSuggestion}
                  onReject={handleRejectSuggestion}
                  onRefresh={handleLoadSuggestions}
                  isLoading={suggestionsLoading}
                />
              )}

              {rightPanelTab === 'validation' && (
                <AIConsistencyPanel companyId={companyId} />
              )}

              {rightPanelTab === 'contracts' && contractStatus && (
                <ContractPanel
                  companyId={companyId}
                  contractStatus={contractStatus}
                />
              )}

              {rightPanelTab === 'contracts' && !contractStatus && (
                <div className="text-center py-8 text-sm text-slate-500">
                  Loading contract status...
                </div>
              )}

              {rightPanelTab === 'logs' && (
                <UpdateLogPanel
                  companyId={companyId}
                  logs={updateLogs}
                  isLoading={logsLoading}
                />
              )}

              {/* Phase 4: Predictive Panel */}
              {rightPanelTab === 'predict' && (
                <PredictivePanel
                  companyId={companyId}
                  onPredictionAccepted={async (path, value) => {
                    await handleSaveField(path, typeof value === 'string' ? value : JSON.stringify(value));
                  }}
                />
              )}

              {/* Phase 4: Temporal Panel */}
              {rightPanelTab === 'temporal' && (
                <TemporalPanel
                  companyId={companyId}
                  selectedDomain={selectedDomain}
                  onFieldSelect={(path) => {
                    const field = fields.find(f => f.path === path);
                    if (field) {
                      setSelectedDomain(field.domain);
                    }
                  }}
                />
              )}

              {/* Phase 4: Collaboration Panel */}
              {rightPanelTab === 'collab' && (
                <CollaborationPanel
                  companyId={companyId}
                  currentUserId="current-user" // TODO: Get from auth
                  currentUserName="Current User" // TODO: Get from auth
                />
              )}

              {/* Phase 4: Benchmarks Panel */}
              {rightPanelTab === 'bench' && (
                <BenchmarksPanel
                  companyId={companyId}
                  companyName={companyName}
                />
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Provenance Modal */}
      {provenanceModalField && (
        <ProvenanceModal
          isOpen={!!provenanceModalField}
          onClose={() => setProvenanceModalField(null)}
          fieldPath={provenanceModalField.path}
          fieldLabel={provenanceModalField.label}
          value={provenanceModalField.value}
          provenance={provenanceModalField.provenance}
        />
      )}

      {/* Explain Field Modal (inline implementation for simplicity) */}
      {explainField && (
        <ExplainFieldModal
          companyId={companyId}
          field={explainField}
          onClose={() => setExplainField(null)}
        />
      )}

      {/* Healing Modal */}
      <HealingModal
        isOpen={showHealingModal}
        onClose={() => setShowHealingModal(false)}
        companyId={companyId}
        report={healingReport}
        isLoading={healingLoading}
        onAcceptFix={handleAcceptHealingFix}
        onRejectFix={async () => {}}
        onAcceptAll={handleAcceptAllHealing}
        onRejectAll={async () => setShowHealingModal(false)}
        onRefresh={handleOpenHealing}
      />
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header({ companyId, companyName }: { companyId: string; companyName: string }) {
  return (
    <div className="border-b border-slate-900 bg-slate-950/80 px-6 py-4">
      <Link
        href={`/c/${companyId}`}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Back to {companyName}
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-slate-100">Context Graph</h1>
    </div>
  );
}

// ============================================================================
// Rebuild Button Component
// ============================================================================

function RebuildButton({ companyId }: { companyId: string }) {
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleRebuild = async () => {
    try {
      setIsRebuilding(true);
      const response = await fetch(`/api/os/companies/${companyId}/context-rebuild`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Rebuild failed');
      }

      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      console.error('Failed to rebuild context:', error);
      alert('Failed to rebuild context. Please try again.');
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <button
      onClick={handleRebuild}
      disabled={isRebuilding}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRebuilding ? (
        <>
          <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" />
          Rebuilding...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rebuild Context
        </>
      )}
    </button>
  );
}

// ============================================================================
// Explain Field Modal Component
// ============================================================================

interface ExplainFieldModalProps {
  companyId: string;
  field: GraphFieldUi;
  onClose: () => void;
}

function ExplainFieldModal({ companyId, field, onClose }: ExplainFieldModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [explanation, setExplanation] = useState<{
    explanation: string;
    importance: string;
    relatedFields: string[];
    sourceSuggestions: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch explanation on mount
  useEffect(() => {
    async function fetchExplanation() {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/context-explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldPath: field.path,
            fieldLabel: field.label,
            fieldValue: field.value,
            domainId: field.domain,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate explanation');
        }

        const data = await response.json();
        setExplanation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchExplanation();
  }, [companyId, field]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">{field.label}</h2>
              <p className="text-xs text-slate-500 font-mono">{field.path}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Generating explanation...</p>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-center">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : explanation ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                  What is this field?
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {explanation.explanation}
                </p>
              </div>

              <div>
                <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                  Why it matters
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {explanation.importance}
                </p>
              </div>

              {explanation.relatedFields.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                    Related fields
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {explanation.relatedFields.map((f) => (
                      <span
                        key={f}
                        className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 border border-slate-700"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {explanation.sourceSuggestions.length > 0 && (
                <div>
                  <h3 className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">
                    How to populate
                  </h3>
                  <ul className="space-y-1.5">
                    {explanation.sourceSuggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="text-amber-400">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
