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

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { DOMAIN_NAMES, type DomainName } from '@/lib/contextGraph/companyContextGraph';
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
import { ValidationPanel } from './components/ValidationPanel';
import { ContractPanel } from './components/ContractPanel';
import { UpdateLogPanel } from './components/UpdateLogPanel';
import { HealingModal } from './components/HealingModal';
import { ContextNodeInspector } from './components/ContextNodeInspector';
import { ContextNodeGraph } from './components/ContextNodeGraph';

// Import Phase 4 components
import {
  CollaborationPanel,
  IntentPanel,
  PredictivePanel,
  TemporalPanel,
  BenchmarksPanel,
} from '@/components/os/context';

// Import Auto-Complete Banner
import { AutoCompleteBanner } from './components/AutoCompleteBanner';

// Import Competitive components
import { PositioningMapSection } from '@/components/competitive';

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
  /** Full health score object with section breakdowns */
  healthScore?: {
    sectionScores: Array<{
      section: string;
      label: string;
      completeness: number;
      criticalCoverage: number;
    }>;
  };
  snapshots: ContextGraphSnapshot[];
  diff: GraphDiffItem[];
  /** Coverage percentage for auto-complete banner (0-100) */
  coveragePercent?: number;
  /** Initial domain to select (from URL query param) */
  initialDomain?: string;
  /** Initial right panel tab to show (from URL query param) */
  initialPanel?: string;
  /** Initial node (field path) to select (from URL query param ?nodeId=) */
  initialNodeId?: string;
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

// Valid panel tab values
type RightPanelTab = 'inspector' | 'snapshots' | 'notes' | 'ai' | 'suggestions' | 'validation' | 'contracts' | 'logs' | 'predict' | 'temporal' | 'collab' | 'bench';
const VALID_PANEL_TABS: RightPanelTab[] = ['inspector', 'snapshots', 'notes', 'ai', 'suggestions', 'validation', 'contracts', 'logs', 'predict', 'temporal', 'collab', 'bench'];

// Primary tabs (always visible) vs Advanced tabs (hidden in "More" dropdown)
interface PanelTabDef {
  id: RightPanelTab;
  label: string;
  description?: string;
}

const PRIMARY_TABS: PanelTabDef[] = [
  { id: 'inspector', label: 'Details', description: 'Inspect selected field' },
  { id: 'snapshots', label: 'History', description: 'Past versions and changes' },
  { id: 'suggestions', label: 'AI', description: 'AI-generated suggestions' },
];

const ADVANCED_TABS: PanelTabDef[] = [
  { id: 'predict', label: 'Predict', description: 'AI predictions for missing fields' },
  { id: 'temporal', label: 'Timeline', description: 'Field changes over time' },
  { id: 'collab', label: 'Collab', description: 'Team collaboration' },
  { id: 'bench', label: 'Benchmarks', description: 'Industry benchmarks' },
  { id: 'validation', label: 'Rules', description: 'Validation rules and issues' },
  { id: 'logs', label: 'Log', description: 'Update activity log' },
];

export function ContextGraphViewer({
  companyId,
  companyName,
  graph,
  fields,
  needsRefresh,
  contextHealthScore,
  healthScore,
  snapshots,
  diff,
  coveragePercent,
  initialDomain,
  initialPanel,
  initialNodeId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Validate initialDomain is a valid ContextDomainId
  // If nodeId is provided, extract domain from it (e.g., "identity.industry" -> "identity")
  const nodeIdDomain = initialNodeId?.split('.')[0] as ContextDomainId | undefined;
  const validInitialDomain = nodeIdDomain && DOMAIN_NAMES.includes(nodeIdDomain)
    ? nodeIdDomain
    : initialDomain && DOMAIN_NAMES.includes(initialDomain as ContextDomainId)
      ? (initialDomain as ContextDomainId)
      : 'identity';

  // Validate initialPanel is a valid tab
  // If nodeId is provided, show inspector panel by default
  const validInitialPanel = initialNodeId
    ? 'inspector' // Show inspector panel when node is selected via URL
    : initialPanel && VALID_PANEL_TABS.includes(initialPanel as RightPanelTab)
      ? (initialPanel as RightPanelTab)
      : 'snapshots';

  const [selectedDomain, setSelectedDomain] = useState<ContextDomainId>(validInitialDomain);

  // Selected node (field) state for the inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId || null);
  const selectedFieldRef = useRef<HTMLDivElement>(null);
  const [showOnlyWithValue, setShowOnlyWithValue] = useState(false);
  const [showOnlyRefreshIssues, setShowOnlyRefreshIssues] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>(validInitialPanel);

  // View mode state (list or graph)
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  // Provenance modal state
  const [provenanceModalField, setProvenanceModalField] = useState<GraphFieldUi | null>(null);

  // Explain field modal state (using ExplainFieldButton inline)
  const [explainField, setExplainField] = useState<GraphFieldUi | null>(null);

  // Phase 3: Locks state
  const [locks, setLocks] = useState<Map<string, FieldLock>>(new Map());
  const [locksLoading, setLocksLoading] = useState(false);

  // Phase 3: Validation state
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);

  // Phase 3: Contract status state
  const [contractStatus, setContractStatus] = useState<GraphContractStatus | null>(null);

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

  // Handle node (field) selection with URL sync
  const handleSelectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);

    // Update URL with nodeId param (shallow navigation)
    const params = new URLSearchParams(searchParams.toString());
    if (nodeId) {
      params.set('nodeId', nodeId);
      // Also ensure we're on the correct domain
      const domain = nodeId.split('.')[0] as ContextDomainId;
      if (DOMAIN_NAMES.includes(domain)) {
        setSelectedDomain(domain);
        setIsGlobalSearch(false);
        setGlobalSearchTerm('');
      }
      // Switch to inspector tab when selecting a node
      setRightPanelTab('inspector');
    } else {
      params.delete('nodeId');
      // Switch back to history tab when deselecting
      if (rightPanelTab === 'inspector') {
        setRightPanelTab('snapshots');
      }
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, rightPanelTab]);

  // Scroll to selected field on mount or when selection changes
  useEffect(() => {
    if (selectedNodeId && selectedFieldRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        selectedFieldRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedNodeId]);

  // Get the selected field data
  const selectedField = useMemo(() => {
    if (!selectedNodeId) return null;
    return fields.find(f => f.path === selectedNodeId) || null;
  }, [fields, selectedNodeId]);

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
        // Use router.refresh() to preserve client state (keeps current domain selection)
        router.refresh();
        return { success: true };
      } else {
        return { success: false, error: data.blockedReason || data.error || 'Failed to save' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save' };
    }
  }, [companyId, router]);

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

  // Phase 4: Prediction accepted handler (for PredictivePanel)
  const handlePredictionAccepted = useCallback(async (path: string, value: unknown): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/context/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          path,
          value,
          updatedBy: 'human',
          sourceTool: 'predict',
          createSnapshot: true,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Use router.refresh() to preserve client state (keeps Predict tab open)
        router.refresh();
        return { success: true };
      } else {
        return { success: false, error: data.blockedReason || data.error || 'Failed to save' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save' };
    }
  }, [companyId, router]);

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
        // Use router.refresh() to preserve client state
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  }, [companyId, router]);

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
              Build the context graph from company data, diagnostics, and insights.
            </p>
            <div className="flex flex-col items-center gap-3">
              <EmptyStateRebuildButton companyId={companyId} />
              <Link
                href={`/c/${companyId}`}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Back to Company
              </Link>
            </div>
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
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-100">Context</h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Edit
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Inspect and edit what Hive knows about this company.
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

          {/* First-time / low-context guidance */}
          {contextHealthScore < 30 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <div>
                  <div className="text-[11px] font-medium text-amber-300">Getting Started</div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Start with Identity and Brand domains. These are foundational for AI-powered strategy.
                  </p>
                  <Link
                    href={`/c/${companyId}/brain/labs`}
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-amber-400 hover:text-amber-300"
                  >
                    Run a diagnostic lab
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Domain Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-slate-600 font-medium">
            Domains
          </div>
          {DOMAIN_NAMES.map((domainId) => {
            const meta = CONTEXT_DOMAIN_META[domainId];
            const domainFields = fieldsByDomain.get(domainId) ?? [];
            const hasIssues = domainFields.some((f) => needsRefreshByPath.has(f.path));

            // Calculate health from actual graph fields (same as DomainSummaryPanel)
            // This ensures sidebar matches the detail panel's percentage
            const totalFields = domainFields.length;
            const populatedFields = domainFields.filter(f => f.value !== null && f.value !== '').length;
            const healthPct = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
            const hasLocks = domainFields.some((f) => locks.has(f.path));
            const isActive = selectedDomain === domainId && !isGlobalSearch;

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
                  'flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors group',
                  isActive
                    ? 'bg-amber-500/10 text-slate-50 border border-amber-500/30'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-100 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Health indicator dot */}
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      healthPct >= 80 && 'bg-emerald-400',
                      healthPct >= 50 && healthPct < 80 && 'bg-amber-400',
                      healthPct < 50 && 'bg-red-400'
                    )}
                  />
                  <span className="truncate">{meta.label}</span>
                </div>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  {hasLocks && (
                    <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {hasIssues && !isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <span
                    className={cn(
                      'text-[10px] tabular-nums',
                      isActive ? 'text-amber-300' : 'text-slate-500 group-hover:text-slate-400'
                    )}
                  >
                    {healthPct}%
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
            {/* Breadcrumb */}
            <div className="text-[11px] text-slate-500 mb-1">
              <Link
                href={`/c/${companyId}/brain/explorer`}
                className="hover:text-slate-300 transition-colors"
              >
                Brain
              </Link>
              <span className="mx-1.5">·</span>
              <span className="text-slate-400">Context</span>
              {!isGlobalSearch && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="text-slate-300">{CONTEXT_DOMAIN_META[selectedDomain].label}</span>
                </>
              )}
            </div>
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
                <div className="text-sm font-medium text-slate-100">
                  {CONTEXT_DOMAIN_META[selectedDomain].label}
                </div>
                {domainMeta.description && (
                  <div className="text-xs text-slate-400 mt-0.5">{domainMeta.description}</div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'graph'
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Graph
              </button>
            </div>

            {/* Filters (only when not in global search and in list mode) */}
            {!isGlobalSearch && viewMode === 'list' && (
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
          {/* Main Content Area - Either List or Graph view */}
          {viewMode === 'graph' ? (
            /* Graph View */
            <section className="flex-1 overflow-hidden">
              <ContextNodeGraph
                fields={fields}
                needsRefresh={needsRefreshByPath}
                companyId={companyId}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
              />
            </section>
          ) : (
            /* List View */
            <section className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Auto-Complete Banner (only when coverage is low) */}
              {coveragePercent !== undefined && coveragePercent < 50 && (
                <AutoCompleteBanner
                  companyId={companyId}
                  coveragePercent={coveragePercent}
                  threshold={50}
                />
              )}

              {/* Domain Summary (only when viewing a domain, not global search) */}
              {!isGlobalSearch && (
                <DomainSummaryPanel
                  domainId={selectedDomain}
                  fields={fieldsByDomain.get(selectedDomain) ?? []}
                  issues={domainIssues}
                  companyId={companyId}
                />
              )}

              {/* Positioning Map (only for competitive domain) */}
              {!isGlobalSearch && selectedDomain === 'competitive' && graph && (
                <PositioningMapSection
                  companyId={companyId}
                  companyName={companyName}
                  competitiveDomain={graph.competitive}
                  canEdit={true}
                  onSaveField={handleSaveField}
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
                    <div
                      key={field.path}
                      ref={field.path === selectedNodeId ? selectedFieldRef : undefined}
                    >
                      <FieldCard
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
                        isSelected={field.path === selectedNodeId}
                        onSelect={() => handleSelectNode(field.path)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Right Panel */}
          <aside className="w-96 border-l border-slate-900 bg-slate-950/80 flex flex-col">
            {/* Tab Navigation - Primary tabs + More dropdown */}
            <RightPanelTabs
              selectedNodeId={selectedNodeId}
              rightPanelTab={rightPanelTab}
              onTabChange={setRightPanelTab}
            />

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Inspector Panel - shows when a node is selected */}
              {rightPanelTab === 'inspector' && selectedField && (
                <ContextNodeInspector
                  field={selectedField}
                  companyId={companyId}
                  issue={needsRefreshByPath.get(selectedField.path)}
                  lock={locks.get(selectedField.path)}
                  onClose={() => handleSelectNode(null)}
                  onEdit={() => {
                    // Trigger edit mode on the field - scroll to it and focus
                    selectedFieldRef.current?.querySelector('button[title="Edit field"]')?.dispatchEvent(
                      new MouseEvent('click', { bubbles: true })
                    );
                  }}
                  onLock={handleLockField}
                  onUnlock={handleUnlockField}
                  onExplain={() => handleExplainField(selectedField)}
                />
              )}

              {rightPanelTab === 'inspector' && !selectedField && (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-slate-400 mb-2">Select a field to inspect</div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Click on any field card in the {viewMode === 'list' ? 'list' : 'graph'} to see its details, provenance history, and available actions.
                  </p>
                  <div className="text-[10px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50"></span>
                      <span>Yellow cards need attention</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/50"></span>
                      <span>Red cards are missing data</span>
                    </div>
                  </div>
                </div>
              )}

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
                  domain={selectedDomain}
                  onPredictionAccepted={handlePredictionAccepted}
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
// Empty State Rebuild Button Component (larger, more prominent)
// ============================================================================

function EmptyStateRebuildButton({ companyId }: { companyId: string }) {
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleRebuild = async () => {
    try {
      setIsRebuilding(true);
      const response = await fetch(`/api/os/companies/${companyId}/context-rebuild`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Rebuild failed');
      }

      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      console.error('Failed to rebuild context:', error);
      alert(error instanceof Error ? error.message : 'Failed to rebuild context. Please try again.');
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <button
      onClick={handleRebuild}
      disabled={isRebuilding}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isRebuilding ? (
        <>
          <div className="w-4 h-4 rounded-full border-2 border-slate-900/30 border-t-slate-900 animate-spin" />
          Building Context Graph...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Build Context Graph
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

// ============================================================================
// Right Panel Tabs Component
// ============================================================================

interface RightPanelTabsProps {
  selectedNodeId: string | null;
  rightPanelTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
}

function RightPanelTabs({ selectedNodeId, rightPanelTab, onTabChange }: RightPanelTabsProps) {
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if current tab is an advanced tab (to highlight "More" button)
  const isAdvancedTabActive = ADVANCED_TABS.some(t => t.id === rightPanelTab);
  const activeAdvancedTab = ADVANCED_TABS.find(t => t.id === rightPanelTab);

  // Build visible primary tabs (show Details/Inspector only when a node is selected)
  const visiblePrimaryTabs = selectedNodeId
    ? PRIMARY_TABS
    : PRIMARY_TABS.filter(t => t.id !== 'inspector');

  return (
    <div className="flex items-center border-b border-slate-900">
      {/* Primary Tabs */}
      <div className="flex flex-1">
        {visiblePrimaryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 px-3 py-2.5 text-xs font-medium transition-colors text-center',
              rightPanelTab === tab.id
                ? 'text-amber-300 border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            )}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* More Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
          className={cn(
            'flex items-center gap-1 px-3 py-2.5 text-xs font-medium transition-colors',
            isAdvancedTabActive
              ? 'text-amber-300 border-b-2 border-amber-400'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {isAdvancedTabActive && activeAdvancedTab ? activeAdvancedTab.label : 'More'}
          <svg
            className={cn(
              'w-3 h-3 transition-transform',
              moreDropdownOpen && 'rotate-180'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {moreDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
            {ADVANCED_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setMoreDropdownOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-xs transition-colors flex flex-col gap-0.5',
                  rightPanelTab === tab.id
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-300 hover:bg-slate-800'
                )}
              >
                <span className="font-medium">{tab.label}</span>
                {tab.description && (
                  <span className="text-[10px] text-slate-500">{tab.description}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
