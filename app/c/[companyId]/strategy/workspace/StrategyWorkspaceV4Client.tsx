'use client';

// app/c/[companyId]/strategy/workspace/StrategyWorkspaceV4Client.tsx
// Strategy Workspace V4 - 3-Column Layout
//
// Left: Inputs (Context + Competition summary)
// Center: Working Area (Artifacts with multi-select, filters, bulk actions)
// Right: Canonical Strategy (read-only, promotion target, provenance drawer)

import { useState, useCallback, useEffect, useMemo, createContext, useContext } from 'react';
import {
  FileText,
  Lightbulb,
  Target,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Eye,
  Edit3,
  Lock,
  Users,
  BarChart3,
  Filter,
  SortDesc,
  CheckSquare,
  Square,
  RotateCcw,
  AlertTriangle,
  Zap,
  Scale,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Compass,
  TrendingUp,
} from 'lucide-react';

// ============================================================================
// Strategy Guidance Context
// ============================================================================

const GUIDANCE_STORAGE_KEY = 'hive-strategy-guidance-enabled';

interface GuidanceContextValue {
  showGuidance: boolean;
  toggleGuidance: () => void;
}

const GuidanceContext = createContext<GuidanceContextValue>({
  showGuidance: true,
  toggleGuidance: () => {},
});

function useGuidance() {
  return useContext(GuidanceContext);
}

function useGuidanceState(): GuidanceContextValue {
  const [showGuidance, setShowGuidance] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUIDANCE_STORAGE_KEY);
      if (stored !== null) {
        setShowGuidance(stored === 'true');
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const toggleGuidance = useCallback(() => {
    setShowGuidance(prev => {
      const next = !prev;
      try {
        localStorage.setItem(GUIDANCE_STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  return { showGuidance, toggleGuidance };
}

import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';
import type {
  StrategyArtifact,
  StrategyArtifactType,
  StrategyArtifactStatus,
  ArtifactSummary,
} from '@/lib/types/strategyArtifact';
import {
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_STATUS_LABELS,
} from '@/lib/types/strategyArtifact';

// ============================================================================
// Artifact Type Hints (for guidance)
// ============================================================================

const ARTIFACT_TYPE_HINTS: Record<StrategyArtifactType, string> = {
  draft_strategy: 'Synthesize your thinking into a cohesive strategic direction',
  growth_option: 'Explore potential growth levers before committing',
  channel_plan: 'Define how you will reach your audience',
  assumptions: 'Make beliefs explicit so they can be validated',
  risk_analysis: 'Identify what could go wrong and plan mitigations',
  synthesis: 'Combine insights from multiple artifacts',
};

// ============================================================================
// Artifact Starter Templates
// ============================================================================

const ARTIFACT_STARTERS: {
  type: StrategyArtifactType;
  title: string;
  description: string;
  icon: React.ReactNode;
  template: string;
}[] = [
  {
    type: 'growth_option',
    title: 'Growth Options',
    description: 'Explore potential growth levers',
    icon: <Lightbulb className="w-5 h-5 text-amber-400" />,
    template: `# Growth Options

## Current State
- Where are we now?
- What's working well?
- What are our constraints?

## Growth Levers
### 1. [Lever Name]
- **Opportunity**: What's the potential?
- **Effort**: Low / Medium / High
- **Timeline**: Quick win / Medium-term / Long-term
- **Dependencies**: What's needed?

### 2. [Lever Name]
- **Opportunity**:
- **Effort**:
- **Timeline**:
- **Dependencies**:

## Prioritization
| Option | Impact | Effort | Priority |
|--------|--------|--------|----------|
|        |        |        |          |

## Next Steps
- [ ]
- [ ]
`,
  },
  {
    type: 'draft_strategy',
    title: 'Draft Strategy',
    description: 'Outline your strategic direction',
    icon: <FileText className="w-5 h-5 text-cyan-400" />,
    template: `# Strategy Draft

## Strategic Intent
What are we trying to achieve? Why now?

## Target Audience
Who are we focused on? What do they need?

## Value Proposition
What unique value do we deliver?

## Strategic Pillars

### Pillar 1: [Name]
- **Focus**:
- **Key Activities**:
- **Success Metrics**:

### Pillar 2: [Name]
- **Focus**:
- **Key Activities**:
- **Success Metrics**:

### Pillar 3: [Name]
- **Focus**:
- **Key Activities**:
- **Success Metrics**:

## Resource Allocation
How will we allocate budget and effort across pillars?

## Timeline
- **Phase 1 (Q1)**:
- **Phase 2 (Q2)**:
- **Phase 3 (Q3-Q4)**:
`,
  },
  {
    type: 'assumptions',
    title: 'Assumptions',
    description: 'Document key assumptions to validate',
    icon: <AlertTriangle className="w-5 h-5 text-purple-400" />,
    template: `# Key Assumptions

## Market Assumptions
- [ ] **Assumption**:
  - Evidence for:
  - Evidence against:
  - How to validate:

- [ ] **Assumption**:
  - Evidence for:
  - Evidence against:
  - How to validate:

## Customer Assumptions
- [ ] **Assumption**:
  - Evidence for:
  - Evidence against:
  - How to validate:

## Competitive Assumptions
- [ ] **Assumption**:
  - Evidence for:
  - Evidence against:
  - How to validate:

## Capability Assumptions
- [ ] **Assumption**:
  - Evidence for:
  - Evidence against:
  - How to validate:

## Validation Plan
| Assumption | Priority | Method | Owner | Due Date |
|------------|----------|--------|-------|----------|
|            |          |        |       |          |
`,
  },
  {
    type: 'risk_analysis',
    title: 'Risks & Tradeoffs',
    description: 'Identify risks and strategic tradeoffs',
    icon: <Scale className="w-5 h-5 text-red-400" />,
    template: `# Risks & Tradeoffs

## Strategic Risks

### High Priority
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
|      |            |        |            |

### Medium Priority
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
|      |            |        |            |

## Key Tradeoffs

### Tradeoff 1: [Name]
- **Option A**:
  - Pros:
  - Cons:
- **Option B**:
  - Pros:
  - Cons:
- **Recommendation**:

### Tradeoff 2: [Name]
- **Option A**:
  - Pros:
  - Cons:
- **Option B**:
  - Pros:
  - Cons:
- **Recommendation**:

## What We're NOT Doing
-
-
-

## Contingency Plans
If [risk/scenario], then we will [response].
`,
  },
];

// ============================================================================
// Types
// ============================================================================

interface ContextSummary {
  companyName: string;
  industry?: string;
  objectives: string[];
  audienceSummary?: string;
  competitionSummary?: string;
  contextCompleteness: number;
}

interface StrategyWorkspaceV4ClientProps {
  companyId: string;
  companyName: string;
  contextSummary: ContextSummary;
  initialArtifacts: ArtifactSummary[];
  canonicalStrategy: CompanyStrategy | null;
}

type StatusFilter = 'all' | StrategyArtifactStatus;
type TypeFilter = 'all' | StrategyArtifactType;
type SortOrder = 'newest' | 'oldest' | 'alphabetical';

// ============================================================================
// Main Component
// ============================================================================

export function StrategyWorkspaceV4Client({
  companyId,
  companyName,
  contextSummary,
  initialArtifacts,
  canonicalStrategy,
}: StrategyWorkspaceV4ClientProps) {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>(initialArtifacts);
  const [selectedArtifact, setSelectedArtifact] = useState<StrategyArtifact | null>(null);
  const [strategy, setStrategy] = useState<CompanyStrategy | null>(canonicalStrategy);
  const [isCreating, setIsCreating] = useState(false);
  const [newArtifactType, setNewArtifactType] = useState<StrategyArtifactType>('draft_strategy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Filter and sort state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Sources drawer state
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);

  // Load full artifact details when selected
  const handleSelectArtifact = useCallback(async (artifactId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts/${artifactId}`);
      const data = await response.json();
      if (data.artifact) {
        setSelectedArtifact(data.artifact);
      }
    } catch (err) {
      setError('Failed to load artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Create new artifact (with optional template)
  const handleCreateArtifact = useCallback(async (type?: StrategyArtifactType, template?: string, title?: string) => {
    setLoading(true);
    setError(null);
    const artifactType = type || newArtifactType;
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: artifactType,
          title: title || `New ${ARTIFACT_TYPE_LABELS[artifactType]}`,
          content: template || '',
          source: 'human',
        }),
      });
      const data = await response.json();
      if (data.artifact) {
        setArtifacts(prev => [data.artifact, ...prev]);
        setSelectedArtifact(data.artifact);
        setIsCreating(false);
      }
    } catch (err) {
      setError('Failed to create artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, newArtifactType]);

  // Create from starter template
  const handleCreateFromStarter = useCallback((starter: typeof ARTIFACT_STARTERS[0]) => {
    handleCreateArtifact(starter.type, starter.template, starter.title);
  }, [handleCreateArtifact]);

  // Update artifact
  const handleUpdateArtifact = useCallback(async (updates: Partial<StrategyArtifact>) => {
    if (!selectedArtifact) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts/${selectedArtifact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (data.artifact) {
        setSelectedArtifact(data.artifact);
        setArtifacts(prev =>
          prev.map(a => (a.id === data.artifact.id ? data.artifact : a))
        );
      }
    } catch (err) {
      setError('Failed to update artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedArtifact]);

  // Mark as candidate for promotion
  const handleMarkCandidate = useCallback(async () => {
    if (!selectedArtifact) return;
    await handleUpdateArtifact({ status: 'candidate' });
  }, [selectedArtifact, handleUpdateArtifact]);

  // Promote artifact to canonical strategy
  const handlePromote = useCallback(async (artifactIds?: string[]) => {
    const idsToPromote = artifactIds || (selectedArtifact ? [selectedArtifact.id] : []);
    if (idsToPromote.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactIds: idsToPromote,
        }),
      });
      const data = await response.json();
      if (data.success && data.strategy) {
        setStrategy(data.strategy);
        // Update artifacts to show promoted status
        if (data.artifact) {
          setSelectedArtifact(data.artifact);
          setArtifacts(prev =>
            prev.map(a => (idsToPromote.includes(a.id) ? { ...a, status: 'promoted' as const } : a))
          );
        }
        setSelectedIds(new Set());
        setIsMultiSelectMode(false);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to promote artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedArtifact]);

  // Discard artifact
  const handleDiscard = useCallback(async () => {
    if (!selectedArtifact) return;
    await handleUpdateArtifact({ status: 'discarded' });
  }, [selectedArtifact, handleUpdateArtifact]);

  // Delete artifact
  const handleDeleteArtifact = useCallback(async () => {
    if (!selectedArtifact) return;
    if (selectedArtifact.status === 'promoted') {
      setError('Cannot delete a promoted artifact');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts/${selectedArtifact.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setArtifacts(prev => prev.filter(a => a.id !== selectedArtifact.id));
        setSelectedArtifact(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete artifact');
      }
    } catch (err) {
      setError('Failed to delete artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedArtifact]);

  // Bulk actions
  const handleBulkUpdateStatus = useCallback(async (status: StrategyArtifactStatus) => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      const updates = Array.from(selectedIds).map(async (id) => {
        const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        return response.json();
      });

      const results = await Promise.all(updates);
      const successful = results.filter(r => r.artifact);

      setArtifacts(prev =>
        prev.map(a => {
          const updated = successful.find(r => r.artifact?.id === a.id);
          return updated ? updated.artifact : a;
        })
      );

      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    } catch (err) {
      setError('Failed to update artifacts');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedIds]);

  // Toggle selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible
  const selectAllVisible = useCallback((filteredArtifacts: ArtifactSummary[]) => {
    setSelectedIds(new Set(filteredArtifacts.map(a => a.id)));
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  }, []);

  // Filter and sort artifacts
  const filteredArtifacts = useMemo(() => {
    let result = [...artifacts];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(a => a.type === typeFilter);
    }

    // Apply sort
    switch (sortOrder) {
      case 'newest':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'alphabetical':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [artifacts, statusFilter, typeFilter, sortOrder]);

  // Check if any selected artifacts can be promoted
  const canPromoteSelected = useMemo(() => {
    if (selectedIds.size === 0) return false;
    return Array.from(selectedIds).some(id => {
      const artifact = artifacts.find(a => a.id === id);
      return artifact && (artifact.status === 'candidate' || artifact.status === 'draft' || artifact.status === 'explored');
    });
  }, [selectedIds, artifacts]);

  // Guidance state
  const guidanceState = useGuidanceState();

  return (
    <GuidanceContext.Provider value={guidanceState}>
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-2">
        {/* Workspace Header with Guidance Toggle */}
        <WorkspaceHeader
          companyName={companyName}
          showGuidance={guidanceState.showGuidance}
          onToggleGuidance={guidanceState.toggleGuidance}
        />

        {/* Promotion Bar (when items selected) */}
        {selectedIds.size > 0 && (
          <PromotionBar
            selectedCount={selectedIds.size}
            canPromote={canPromoteSelected}
            loading={loading}
            onPromote={() => handlePromote(Array.from(selectedIds))}
            onMarkCandidate={() => handleBulkUpdateStatus('candidate')}
            onDiscard={() => handleBulkUpdateStatus('discarded')}
            onRestore={() => handleBulkUpdateStatus('draft')}
            onClear={clearSelection}
          />
        )}

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Column: Inputs */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
            <InputsPanel contextSummary={contextSummary} />
          </div>

          {/* Center Column: Working Area */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <WorkingAreaPanel
              artifacts={filteredArtifacts}
              allArtifacts={artifacts}
              selectedArtifact={selectedArtifact}
              selectedIds={selectedIds}
              isMultiSelectMode={isMultiSelectMode}
              isCreating={isCreating}
              newArtifactType={newArtifactType}
              loading={loading}
              error={error}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              sortOrder={sortOrder}
              onSelectArtifact={handleSelectArtifact}
              onToggleSelection={toggleSelection}
              onSelectAllVisible={() => selectAllVisible(filteredArtifacts)}
              onToggleMultiSelect={() => setIsMultiSelectMode(prev => !prev)}
              onCreateStart={() => setIsCreating(true)}
              onCreateCancel={() => setIsCreating(false)}
              onCreateConfirm={() => handleCreateArtifact()}
              onCreateFromStarter={handleCreateFromStarter}
              onNewTypeChange={setNewArtifactType}
              onUpdateArtifact={handleUpdateArtifact}
              onMarkCandidate={handleMarkCandidate}
              onPromote={() => handlePromote()}
              onDiscard={handleDiscard}
              onDelete={handleDeleteArtifact}
              onStatusFilterChange={setStatusFilter}
              onTypeFilterChange={setTypeFilter}
              onSortOrderChange={setSortOrder}
            />
          </div>

          {/* Right Column: Canonical Strategy */}
          <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
            <CanonicalStrategyPanel
              strategy={strategy}
              artifacts={artifacts}
              showSourcesDrawer={showSourcesDrawer}
              onToggleSourcesDrawer={() => setShowSourcesDrawer(prev => !prev)}
            />
          </div>
        </div>
      </div>
    </GuidanceContext.Provider>
  );
}

// ============================================================================
// Workspace Header with Guidance Toggle
// ============================================================================

function WorkspaceHeader({
  companyName,
  showGuidance,
  onToggleGuidance,
}: {
  companyName: string;
  showGuidance: boolean;
  onToggleGuidance: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-white">Strategy Workspace</h1>
        <span className="text-sm text-slate-500">for {companyName}</span>
      </div>
      <button
        onClick={onToggleGuidance}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
        title="Show or hide guidance on how to build a strategy"
      >
        {showGuidance ? (
          <ToggleRight className="w-4 h-4 text-cyan-400" />
        ) : (
          <ToggleLeft className="w-4 h-4" />
        )}
        <span className={showGuidance ? 'text-cyan-400' : ''}>
          Strategy guidance
        </span>
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// Promotion Bar (Selection Actions)
// ============================================================================

function PromotionBar({
  selectedCount,
  canPromote,
  loading,
  onPromote,
  onMarkCandidate,
  onDiscard,
  onRestore,
  onClear,
}: {
  selectedCount: number;
  canPromote: boolean;
  loading: boolean;
  onPromote: () => void;
  onMarkCandidate: () => void;
  onDiscard: () => void;
  onRestore: () => void;
  onClear: () => void;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-200">
          {selectedCount} artifact{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-slate-300"
        >
          Clear
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRestore}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-200 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </button>
        <button
          onClick={onDiscard}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Discard
        </button>
        <button
          onClick={onMarkCandidate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Mark Candidate
        </button>
        <button
          onClick={onPromote}
          disabled={loading || !canPromote}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
          Promote to Canonical
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Inputs Panel (Left Column)
// ============================================================================

function InputsPanel({ contextSummary }: { contextSummary: ContextSummary }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-cyan-400" />
        Inputs
      </h2>

      {/* Context Completeness */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400">Context Completeness</span>
          <span className="text-slate-300">{contextSummary.contextCompleteness}%</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              contextSummary.contextCompleteness >= 80
                ? 'bg-emerald-500'
                : contextSummary.contextCompleteness >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${contextSummary.contextCompleteness}%` }}
          />
        </div>
      </div>

      {/* Objectives */}
      <div className="mb-4">
        <h3 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Objectives
        </h3>
        {contextSummary.objectives.length > 0 ? (
          <ul className="space-y-1.5">
            {contextSummary.objectives.slice(0, 3).map((obj, i) => (
              <li key={i} className="text-xs text-slate-300 pl-3 border-l-2 border-cyan-500/30">
                {obj}
              </li>
            ))}
            {contextSummary.objectives.length > 3 && (
              <li className="text-xs text-slate-500 pl-3">
                +{contextSummary.objectives.length - 3} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No objectives defined</p>
        )}
      </div>

      {/* Audience Summary */}
      {contextSummary.audienceSummary && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Audience
          </h3>
          <p className="text-xs text-slate-300 line-clamp-3">
            {contextSummary.audienceSummary}
          </p>
        </div>
      )}

      {/* Competition Summary */}
      {contextSummary.competitionSummary && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Competition
          </h3>
          <p className="text-xs text-slate-300 line-clamp-3">
            {contextSummary.competitionSummary}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Working Area Panel (Center Column)
// ============================================================================

function WorkingAreaPanel({
  artifacts,
  allArtifacts,
  selectedArtifact,
  selectedIds,
  isMultiSelectMode,
  isCreating,
  newArtifactType,
  loading,
  error,
  statusFilter,
  typeFilter,
  sortOrder,
  onSelectArtifact,
  onToggleSelection,
  onSelectAllVisible,
  onToggleMultiSelect,
  onCreateStart,
  onCreateCancel,
  onCreateConfirm,
  onCreateFromStarter,
  onNewTypeChange,
  onUpdateArtifact,
  onMarkCandidate,
  onPromote,
  onDiscard,
  onDelete,
  onStatusFilterChange,
  onTypeFilterChange,
  onSortOrderChange,
}: {
  artifacts: ArtifactSummary[];
  allArtifacts: ArtifactSummary[];
  selectedArtifact: StrategyArtifact | null;
  selectedIds: Set<string>;
  isMultiSelectMode: boolean;
  isCreating: boolean;
  newArtifactType: StrategyArtifactType;
  loading: boolean;
  error: string | null;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  sortOrder: SortOrder;
  onSelectArtifact: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onSelectAllVisible: () => void;
  onToggleMultiSelect: () => void;
  onCreateStart: () => void;
  onCreateCancel: () => void;
  onCreateConfirm: () => void;
  onCreateFromStarter: (starter: typeof ARTIFACT_STARTERS[0]) => void;
  onNewTypeChange: (type: StrategyArtifactType) => void;
  onUpdateArtifact: (updates: Partial<StrategyArtifact>) => void;
  onMarkCandidate: () => void;
  onPromote: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
  onSortOrderChange: (order: SortOrder) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Working Area
          <span className="text-xs text-slate-500">({artifacts.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMultiSelect}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${
              isMultiSelectMode
                ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-300 bg-slate-800 border-slate-700'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Select
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${
              showFilters || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-300 bg-slate-800 border-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          <button
            onClick={onCreateStart}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Filters Row */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/30 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={e => onStatusFilterChange(e.target.value as StatusFilter)}
              className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="explored">Explored</option>
              <option value="candidate">Candidate</option>
              <option value="promoted">Promoted</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Type:</span>
            <select
              value={typeFilter}
              onChange={e => onTypeFilterChange(e.target.value as TypeFilter)}
              className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
            >
              <option value="all">All</option>
              {Object.entries(ARTIFACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Sort:</span>
            <select
              value={sortOrder}
              onChange={e => onSortOrderChange(e.target.value as SortOrder)}
              className="px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => {
                onStatusFilterChange('all');
                onTypeFilterChange('all');
              }}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Artifact List */}
        <div className="w-56 border-r border-slate-800 overflow-y-auto flex-shrink-0">
          {isCreating && (
            <div className="p-3 border-b border-slate-800 bg-slate-800/50">
              <select
                value={newArtifactType}
                onChange={e => onNewTypeChange(e.target.value as StrategyArtifactType)}
                className="w-full px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 mb-2"
              >
                {Object.entries(ARTIFACT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={onCreateConfirm}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Create
                </button>
                <button
                  onClick={onCreateCancel}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Multi-select header */}
          {isMultiSelectMode && artifacts.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
              <button
                onClick={onSelectAllVisible}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Select all ({artifacts.length})
              </button>
            </div>
          )}

          {allArtifacts.length === 0 && !isCreating ? (
            // Empty state with starters
            <ArtifactStarters onCreateFromStarter={onCreateFromStarter} />
          ) : artifacts.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-500">No artifacts match filters</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {artifacts.map(artifact => (
                <ArtifactListItem
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifact?.id === artifact.id}
                  isChecked={selectedIds.has(artifact.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  onSelect={() => onSelectArtifact(artifact.id)}
                  onToggleCheck={() => onToggleSelection(artifact.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Artifact Detail/Editor */}
        <div className="flex-1 overflow-y-auto">
          {selectedArtifact ? (
            <ArtifactEditor
              artifact={selectedArtifact}
              loading={loading}
              onUpdate={onUpdateArtifact}
              onMarkCandidate={onMarkCandidate}
              onPromote={onPromote}
              onDiscard={onDiscard}
              onDelete={onDelete}
            />
          ) : allArtifacts.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center max-w-sm">
                <Zap className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-slate-200 mb-2">Start Building Your Strategy</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Choose a starter template from the left to begin exploring strategic options.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Select an artifact to view or edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty Workspace Guidance Card
// ============================================================================

function EmptyWorkspaceGuidance() {
  const { showGuidance } = useGuidance();

  if (!showGuidance) return null;

  return (
    <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Compass className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white mb-1">How to Build a Strategy</h3>
          <p className="text-xs text-slate-400">Follow these steps to develop your strategy</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-cyan-400 bg-cyan-500/20 rounded-full flex-shrink-0">
            1
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">Explore options</p>
            <p className="text-[10px] text-slate-500">Create artifacts to explore growth levers, channel plans, and strategic directions</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-purple-400 bg-purple-500/20 rounded-full flex-shrink-0">
            2
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">Make assumptions explicit</p>
            <p className="text-[10px] text-slate-500">Document what you believe to be true so it can be validated</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-amber-400 bg-amber-500/20 rounded-full flex-shrink-0">
            3
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">Synthesize into a draft</p>
            <p className="text-[10px] text-slate-500">Combine your best ideas into a cohesive strategy artifact</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center text-xs font-medium text-emerald-400 bg-emerald-500/20 rounded-full flex-shrink-0">
            4
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200">Promote when confident</p>
            <p className="text-[10px] text-slate-500">Mark as candidate and promote to make it your canonical strategy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Artifact Starters (Empty State)
// ============================================================================

function ArtifactStarters({
  onCreateFromStarter,
}: {
  onCreateFromStarter: (starter: typeof ARTIFACT_STARTERS[0]) => void;
}) {
  const { showGuidance } = useGuidance();

  return (
    <div className="p-3 space-y-3">
      {/* Guidance Card */}
      <EmptyWorkspaceGuidance />

      {/* Starters */}
      <div className="space-y-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Quick Start</p>
        {ARTIFACT_STARTERS.map((starter) => (
          <button
            key={starter.type}
            onClick={() => onCreateFromStarter(starter)}
            className="w-full p-3 text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{starter.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 group-hover:text-white">
                  {starter.title}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {starter.description}
                </p>
                {/* Type hint (guidance) */}
                {showGuidance && ARTIFACT_TYPE_HINTS[starter.type] && (
                  <p className="text-[10px] text-cyan-400/70 mt-1 italic">
                    {ARTIFACT_TYPE_HINTS[starter.type]}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 mt-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Artifact List Item
// ============================================================================

function ArtifactListItem({
  artifact,
  isSelected,
  isChecked,
  isMultiSelectMode,
  onSelect,
  onToggleCheck,
}: {
  artifact: ArtifactSummary;
  isSelected: boolean;
  isChecked: boolean;
  isMultiSelectMode: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}) {
  return (
    <div
      className={`w-full p-3 text-left hover:bg-slate-800/50 transition-colors flex items-start gap-2 ${
        isSelected ? 'bg-slate-800/50' : ''
      }`}
    >
      {isMultiSelectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          className="mt-0.5 flex-shrink-0"
        >
          {isChecked ? (
            <CheckSquare className="w-4 h-4 text-cyan-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-500 hover:text-slate-400" />
          )}
        </button>
      )}
      <button onClick={onSelect} className="flex-1 text-left min-w-0">
        <div className="flex items-start gap-2">
          <ArtifactTypeIcon type={artifact.type} className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">
              {artifact.title}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {ARTIFACT_TYPE_LABELS[artifact.type]}
            </p>
          </div>
          <StatusBadge status={artifact.status} />
        </div>
      </button>
    </div>
  );
}

// ============================================================================
// Artifact Editor
// ============================================================================

function ArtifactEditor({
  artifact,
  loading,
  onUpdate,
  onMarkCandidate,
  onPromote,
  onDiscard,
  onDelete,
}: {
  artifact: StrategyArtifact;
  loading: boolean;
  onUpdate: (updates: Partial<StrategyArtifact>) => void;
  onMarkCandidate: () => void;
  onPromote: () => void;
  onDiscard: () => void;
  onDelete: () => void;
}) {
  const { showGuidance } = useGuidance();
  const [title, setTitle] = useState(artifact.title);
  const [content, setContent] = useState(artifact.content);

  // Reset local state when artifact changes (important for persistence)
  useEffect(() => {
    setTitle(artifact.title);
    setContent(artifact.content);
  }, [artifact.id, artifact.title, artifact.content]);

  const isDirty = title !== artifact.title || content !== artifact.content;
  const isEditable = artifact.status === 'draft' || artifact.status === 'explored';
  const canPromote = artifact.status === 'candidate';
  const canMarkCandidate = artifact.status === 'draft' || artifact.status === 'explored';
  const canDelete = artifact.status !== 'promoted';

  const handleSave = useCallback(() => {
    onUpdate({ title, content });
  }, [title, content, onUpdate]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            disabled={!isEditable}
            className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-medium disabled:opacity-60"
          />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500">
              {ARTIFACT_TYPE_LABELS[artifact.type]}
            </span>
            {showGuidance && (
              <span className="text-xs text-slate-600 italic">
                — {ARTIFACT_TYPE_HINTS[artifact.type]}
              </span>
            )}
            <span className="text-slate-700">•</span>
            <StatusBadge status={artifact.status} />
            {artifact.source === 'ai_tool' && (
              <>
                <span className="text-slate-700">•</span>
                <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                  <Sparkles className="w-3 h-3" />
                  AI Generated
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          disabled={!isEditable}
          placeholder="Write your artifact content here... (Markdown supported)"
          rows={16}
          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-60 font-mono"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          {canMarkCandidate && (
            <button
              onClick={onMarkCandidate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Candidate
            </button>
          )}
          {canPromote && (
            <button
              onClick={onPromote}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRight className="w-3.5 h-3.5" />
              )}
              Promote to Canonical
            </button>
          )}
          {artifact.status !== 'promoted' && artifact.status !== 'discarded' && (
            <button
              onClick={onDiscard}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-amber-400"
            >
              <X className="w-3.5 h-3.5" />
              Discard
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
        {isDirty && isEditable && (
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Canonical Strategy Panel (Right Column)
// ============================================================================

function CanonicalStrategyPanel({
  strategy,
  artifacts,
  showSourcesDrawer,
  onToggleSourcesDrawer,
}: {
  strategy: CompanyStrategy | null;
  artifacts: ArtifactSummary[];
  showSourcesDrawer: boolean;
  onToggleSourcesDrawer: () => void;
}) {
  // Find source artifacts if strategy has them
  const sourceArtifacts = useMemo(() => {
    if (!strategy?.sourceArtifactIds) return [];
    return artifacts.filter(a => strategy.sourceArtifactIds?.includes(a.id));
  }, [strategy, artifacts]);

  if (!strategy) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-slate-200 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-400" />
          Canonical Strategy
        </h2>
        <div className="py-8 text-center">
          <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-2">No canonical strategy yet</p>
          <p className="text-xs text-slate-600">
            Promote artifacts from the Working Area to create a canonical strategy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Provenance Strip */}
      {strategy.sourceArtifactIds && strategy.sourceArtifactIds.length > 0 && (
        <button
          onClick={onToggleSourcesDrawer}
          className="w-full px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between hover:bg-purple-500/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-300">
              Built from {strategy.sourceArtifactIds.length} artifact{strategy.sourceArtifactIds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-purple-400">
            <Eye className="w-3.5 h-3.5" />
            View sources
            {showSourcesDrawer ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
        </button>
      )}

      {/* Sources Drawer */}
      {showSourcesDrawer && sourceArtifacts.length > 0 && (
        <div className="border-b border-slate-800 bg-slate-800/30">
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Source Artifacts</p>
            {sourceArtifacts.map(artifact => (
              <div
                key={artifact.id}
                className="p-2 bg-slate-800/50 border border-slate-700 rounded flex items-start gap-2"
              >
                <ArtifactTypeIcon type={artifact.type} className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{artifact.title}</p>
                  <p className="text-[10px] text-slate-500">{ARTIFACT_TYPE_LABELS[artifact.type]}</p>
                </div>
                <StatusBadge status={artifact.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Canonical Strategy
          </h2>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
              strategy.status === 'finalized'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {strategy.status === 'finalized' ? (
              <Lock className="w-3 h-3" />
            ) : (
              <Edit3 className="w-3 h-3" />
            )}
            {strategy.status === 'finalized' ? 'Finalized' : 'Draft'}
          </span>
        </div>

        {/* Strategy Title */}
        <h3 className="text-base font-medium text-white mb-2">{strategy.title}</h3>
        <p className="text-xs text-slate-400 mb-4 line-clamp-3">{strategy.summary}</p>

        {/* Pillars */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Pillars ({strategy.pillars.length})
          </h4>
          {strategy.pillars.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No pillars defined</p>
          ) : (
            <div className="space-y-2">
              {strategy.pillars.map((pillar, index) => (
                <div
                  key={pillar.id}
                  className="p-2.5 bg-slate-800/50 border border-slate-700 rounded-lg"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] font-medium text-slate-400 bg-slate-700 rounded">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200">{pillar.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                        {pillar.description}
                      </p>
                      {pillar.sourceArtifactId && (
                        <p className="text-[10px] text-purple-400 mt-1 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          From artifact
                        </p>
                      )}
                    </div>
                    <PriorityBadge priority={pillar.priority} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Provenance Info */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Provenance
          </h4>

          {/* Context Revision */}
          {strategy.baseContextRevisionId && (
            <div className="flex items-start gap-2">
              <FileText className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-400">
                Context: <span className="font-mono text-slate-500">{strategy.baseContextRevisionId.slice(0, 12)}...</span>
              </p>
            </div>
          )}

          {/* Competition Source */}
          {strategy.competitionSourceUsed && (
            <div className="flex items-start gap-2">
              <BarChart3 className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-400">
                Competition: {strategy.competitionSourceUsed.toUpperCase()}
              </p>
            </div>
          )}

          {/* Hive Brain Revision */}
          {strategy.hiveBrainRevisionId && (
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-400">
                Hive Brain: <span className="font-mono text-slate-500">{strategy.hiveBrainRevisionId.slice(0, 12)}...</span>
              </p>
            </div>
          )}

          {/* Incomplete Context Warning */}
          {strategy.generatedWithIncompleteContext && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded">
              <AlertCircle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-amber-400">Generated with incomplete context</p>
                {strategy.missingSrmFields && strategy.missingSrmFields.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Missing: {strategy.missingSrmFields.slice(0, 3).join(', ')}
                    {strategy.missingSrmFields.length > 3 && ` +${strategy.missingSrmFields.length - 3} more`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-1">
            <span>Created {new Date(strategy.createdAt).toLocaleDateString()}</span>
            {strategy.finalizedAt && (
              <span>Finalized {new Date(strategy.finalizedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ArtifactTypeIcon({
  type,
  className,
}: {
  type: StrategyArtifactType;
  className?: string;
}) {
  switch (type) {
    case 'draft_strategy':
      return <FileText className={className} />;
    case 'growth_option':
      return <Lightbulb className={className} />;
    case 'channel_plan':
      return <Target className={className} />;
    case 'assumptions':
      return <AlertTriangle className={className} />;
    case 'risk_analysis':
      return <Scale className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function StatusBadge({ status }: { status: StrategyArtifactStatus }) {
  const colors: Record<StrategyArtifactStatus, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    explored: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    discarded: 'bg-red-500/10 text-red-400 border-red-500/30',
    candidate: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    promoted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };

  return (
    <span
      className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border ${colors[status]}`}
    >
      {ARTIFACT_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: StrategyPillar['priority'] }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[priority]}`}>
      {priority}
    </span>
  );
}
