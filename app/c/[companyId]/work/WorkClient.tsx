'use client';

// app/c/[companyId]/work/WorkClient.tsx
// Work Hub - Tasks, Experiments, and Backlog
//
// Master-detail layout with:
// - Left pane: WorkListPanel (search, filters, compact list)
// - Right pane: WorkDetailsPanel (details, AI guide, tabs)
// - Sub-tabs: Tasks (master-detail), Experiments, Backlog

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lightbulb, Zap, Plus, Loader2, ArrowRight, Target, Clock, FileText, X, ExternalLink, Layers, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import type { ExtendedNextBestAction } from '@/lib/os/companies/nextBestAction.types';
import type {
  WorkItemRecord,
  WorkItemStatus,
} from '@/lib/airtable/workItems';
import type { PriorityItem } from '@/lib/airtable/fullReports';
import type { EvidencePayload } from '@/lib/gap/types';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { Workstream, Task } from '@/lib/types/workMvp';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types/workMvp';
import PriorityCardWithAction from './PriorityCardWithAction';
import { ExperimentsClient } from '@/components/experiments/ExperimentsClient';
import { WorkListPanel } from '@/components/os/work/WorkListPanel';
import { WorkDetailsPanel } from '@/components/os/work/WorkDetailsPanel';
import { isArtifactSource } from '@/lib/types/work';
import type { WorkItemArtifact } from '@/lib/types/work';

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
}

export interface WorkClientProps {
  company: CompanyData;
  workItems: WorkItemRecord[];
  mvpWorkstreams?: Workstream[];
  mvpTasks?: Task[];
  priorities: PriorityItem[];
  evidence?: EvidencePayload;
  strategicSnapshot?: CompanyStrategicSnapshot | null;
  fullReportId?: string;
  workItemsByPriorityId: Record<string, WorkItemRecord>;
}

type ActiveTab = 'tasks' | 'experiments' | 'backlog';

// ============================================================================
// Main Component
// ============================================================================

export function WorkClient({
  company,
  workItems,
  mvpWorkstreams = [],
  mvpTasks = [],
  priorities,
  evidence,
  strategicSnapshot,
  fullReportId,
  workItemsByPriorityId,
}: WorkClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [aiAdditionalInfo, setAiAdditionalInfo] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Check for artifact filter from URL
  const artifactIdFilter = searchParams.get('artifactId');

  // Check for strategy filter from URL
  const strategyIdFilter = searchParams.get('strategyId');

  // Check for program filter from URL
  const programIdFilter = searchParams.get('programId');

  // Check for workItemId from URL (for deep-linking)
  const workItemIdFromUrl = searchParams.get('workItemId');

  // Initialize selection from URL
  useEffect(() => {
    if (workItemIdFromUrl && !selectedWorkItemId) {
      setSelectedWorkItemId(workItemIdFromUrl);
    }
  }, [workItemIdFromUrl, selectedWorkItemId]);

  // Get selected work item from ID
  const selectedWorkItem = useMemo(() => {
    if (!selectedWorkItemId) return null;
    return workItems.find(item => item.id === selectedWorkItemId) || null;
  }, [selectedWorkItemId, workItems]);

  // Artifact details for filter display
  const [artifactTitle, setArtifactTitle] = useState<string | null>(null);
  const [loadingArtifact, setLoadingArtifact] = useState(false);

  // Strategy details for filter display
  const [strategyTitle, setStrategyTitle] = useState<string | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

  // Program details for filter display
  const [programTitle, setProgramTitle] = useState<string | null>(null);
  const [loadingProgram, setLoadingProgram] = useState(false);

  // Fetch artifact details when filtering
  useEffect(() => {
    if (!artifactIdFilter) {
      setArtifactTitle(null);
      return;
    }

    setLoadingArtifact(true);
    fetch(`/api/os/companies/${company.id}/artifacts/${artifactIdFilter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.artifact?.title) {
          setArtifactTitle(data.artifact.title);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingArtifact(false));
  }, [artifactIdFilter, company.id]);

  // Fetch strategy details when filtering
  useEffect(() => {
    if (!strategyIdFilter) {
      setStrategyTitle(null);
      return;
    }

    setLoadingStrategy(true);
    fetch(`/api/os/companies/${company.id}/strategy/${strategyIdFilter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.strategy?.title) {
          setStrategyTitle(data.strategy.title);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStrategy(false));
  }, [strategyIdFilter, company.id]);

  // Fetch program details when filtering
  useEffect(() => {
    if (!programIdFilter) {
      setProgramTitle(null);
      return;
    }

    setLoadingProgram(true);
    fetch(`/api/os/programs/${programIdFilter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.program?.title) {
          setProgramTitle(data.program.title);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProgram(false));
  }, [programIdFilter]);

  // Filter work items by artifact, strategy, or program if filter is present
  const filteredWorkItems = useMemo(() => {
    let items = workItems;

    // Filter by artifact
    if (artifactIdFilter) {
      items = items.filter((item) => {
        // Check if work item was created from this artifact
        if (item.source && isArtifactSource(item.source) && item.source.artifactId === artifactIdFilter) {
          return true;
        }

        // Check if artifact is attached to this work item
        const artifacts = item.artifacts as WorkItemArtifact[] | undefined;
        if (artifacts && artifacts.some(a => a.artifactId === artifactIdFilter)) {
          return true;
        }

        return false;
      });
    }

    // Filter by strategy
    if (strategyIdFilter) {
      items = items.filter((item) => {
        return item.strategyLink?.strategyId === strategyIdFilter;
      });
    }

    // Filter by program
    if (programIdFilter) {
      items = items.filter((item) => {
        return item.programId === programIdFilter;
      });
    }

    return items;
  }, [workItems, artifactIdFilter, strategyIdFilter, programIdFilter]);

  // Clear artifact filter
  const clearArtifactFilter = useCallback(() => {
    router.push(`/c/${company.id}/work`);
  }, [router, company.id]);

  // Clear strategy filter
  const clearStrategyFilter = useCallback(() => {
    router.push(`/c/${company.id}/work`);
  }, [router, company.id]);

  // Clear program filter
  const clearProgramFilter = useCallback(() => {
    router.push(`/c/${company.id}/work`);
  }, [router, company.id]);

  // Active items (non-Done) for initial suggestions collapse logic
  const activeItems = filteredWorkItems.filter((w) => w.status !== 'Done');

  // Handle selecting a work item (updates URL shallowly)
  const handleSelectWorkItem = useCallback((item: WorkItemRecord | null) => {
    if (item && selectedWorkItemId === item.id) {
      // Deselect if clicking same item
      setSelectedWorkItemId(null);
      setAiAdditionalInfo(null);
      setAiError(null);
      // Update URL to remove workItemId
      const params = new URLSearchParams(searchParams.toString());
      params.delete('workItemId');
      router.replace(`/c/${company.id}/work${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    } else if (item) {
      setSelectedWorkItemId(item.id);
      setAiAdditionalInfo(item.aiAdditionalInfo || null);
      setAiError(null);
      // Update URL with workItemId (preserve other filters)
      const params = new URLSearchParams(searchParams.toString());
      params.set('workItemId', item.id);
      router.replace(`/c/${company.id}/work?${params.toString()}`, { scroll: false });
    } else {
      setSelectedWorkItemId(null);
      setAiAdditionalInfo(null);
      setAiError(null);
      // Update URL to remove workItemId
      const params = new URLSearchParams(searchParams.toString());
      params.delete('workItemId');
      router.replace(`/c/${company.id}/work${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false });
    }
  }, [selectedWorkItemId, searchParams, router, company.id]);

  // Fetch AI additional info
  const handleAdditionalInfo = useCallback(async () => {
    if (!selectedWorkItem) return;

    setLoadingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/work/additional-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workItemId: selectedWorkItem.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate additional info');
      }

      setAiAdditionalInfo(data.markdown);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingAI(false);
    }
  }, [selectedWorkItem]);

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Work</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track execution of committed programs.
          </p>
        </div>
      </div>

      {/* Artifact Filter Banner - Compact */}
      {artifactIdFilter && (
        <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">
              {loadingArtifact ? 'Loading...' : artifactTitle || 'Artifact filter'}
            </span>
            <span className="text-xs text-purple-400/70">
              ({filteredWorkItems.length} item{filteredWorkItems.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${company.id}/artifacts/${artifactIdFilter}`}
              className="text-xs text-purple-300 hover:text-purple-200"
            >
              View
            </Link>
            <button onClick={clearArtifactFilter} className="text-slate-400 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Strategy Filter Banner - Compact */}
      {strategyIdFilter && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">
              {loadingStrategy ? 'Loading...' : strategyTitle || 'Strategy filter'}
            </span>
            <span className="text-xs text-blue-400/70">
              ({filteredWorkItems.length} item{filteredWorkItems.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${company.id}/strategy?id=${strategyIdFilter}`}
              className="text-xs text-blue-300 hover:text-blue-200"
            >
              View
            </Link>
            <button onClick={clearStrategyFilter} className="text-slate-400 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Program Filter Banner - Compact */}
      {programIdFilter && (
        <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300">
              {loadingProgram ? 'Loading...' : programTitle || 'Program filter'}
            </span>
            <span className="text-xs text-cyan-400/70">
              ({filteredWorkItems.length} item{filteredWorkItems.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${company.id}/deliver?programId=${programIdFilter}`}
              className="text-xs text-cyan-300 hover:text-cyan-200"
            >
              View
            </Link>
            <button onClick={clearProgramFilter} className="text-slate-400 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-tabs with Media link */}
      <div className="border-b border-slate-800">
        <div className="flex items-center justify-between">
          <nav className="flex gap-4">
            <TabButton
              active={activeTab === 'tasks'}
              onClick={() => setActiveTab('tasks')}
              count={activeItems.length}
            >
              Tasks
            </TabButton>
            <TabButton
              active={activeTab === 'experiments'}
              onClick={() => setActiveTab('experiments')}
            >
              Experiments
            </TabButton>
            <TabButton
              active={activeTab === 'backlog'}
              onClick={() => setActiveTab('backlog')}
              count={priorities.length}
            >
              Opportunities
            </TabButton>
          </nav>

          {/* Quick Access Links */}
          <div className="flex items-center gap-2">
            <Link
              href={`/c/${company.id}/plan`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Plan
            </Link>
            <Link
              href={`/c/${company.id}/reports/qbr`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              QBR
            </Link>
            <Link
              href={`/c/${company.id}/media`}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Media
            </Link>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'tasks' && (
        <TasksSection
          workItems={filteredWorkItems}
          activeItems={activeItems}
          selectedWorkItem={selectedWorkItem}
          selectedWorkItemId={selectedWorkItemId}
          onSelectWorkItem={handleSelectWorkItem}
          aiAdditionalInfo={aiAdditionalInfo}
          loadingAI={loadingAI}
          aiError={aiError}
          onAdditionalInfo={handleAdditionalInfo}
          companyId={company.id}
        />
      )}

      {activeTab === 'experiments' && (
        <ExperimentsClient
          companyId={company.id}
          companyName={company.name}
          showCompanyColumn={false}
          title=""
          description=""
        />
      )}

      {activeTab === 'backlog' && (
        <BacklogSection
          priorities={priorities}
          evidence={evidence}
          strategicSnapshot={strategicSnapshot}
          fullReportId={fullReportId}
          companyId={company.id}
          workItemsByPriorityId={workItemsByPriorityId}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
        active
          ? 'border-amber-500 text-amber-400'
          : 'border-transparent text-slate-400 hover:text-slate-300'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.5 text-xs rounded ${
          active ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-400'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function TasksSection({
  workItems,
  activeItems,
  selectedWorkItem,
  selectedWorkItemId,
  onSelectWorkItem,
  aiAdditionalInfo,
  loadingAI,
  aiError,
  onAdditionalInfo,
  companyId,
}: {
  workItems: WorkItemRecord[];
  activeItems: WorkItemRecord[];
  selectedWorkItem: WorkItemRecord | null;
  selectedWorkItemId: string | null;
  onSelectWorkItem: (item: WorkItemRecord | null) => void;
  aiAdditionalInfo: string | null;
  loadingAI: boolean;
  aiError: string | null;
  onAdditionalInfo: () => void;
  companyId: string;
}) {
  const hasWorkItems = workItems.length > 0;

  // Suggested Actions state
  const [suggestedActions, setSuggestedActions] = useState<ExtendedNextBestAction[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [addingActionId, setAddingActionId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [suggestionsCollapsed, setSuggestionsCollapsed] = useState(activeItems.length > 0);

  // Fetch suggested actions
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/next-best-actions?limit=3`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestedActions(data.actions || []);
        }
      } catch (error) {
        console.error('Failed to fetch suggested actions:', error);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [companyId]);

  // Handle adding a suggested action to work
  const handleAddSuggestionToWork = async (action: ExtendedNextBestAction) => {
    if (addingActionId) return;
    setAddingActionId(action.id);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: action.action,
          description: `${action.reason}\n\n**Expected Impact:** ${action.expectedImpact || 'Not specified'}\n\n_Source: AI Recommendation_`,
          area: action.category || 'Strategy',
          priority: action.priority === 'high' ? 'High' : action.priority === 'medium' ? 'Medium' : 'Low',
          status: 'Backlog',
          sourceType: 'AI Recommendation',
          sourceId: action.id,
        }),
      });

      if (response.ok) {
        setAddedIds(prev => new Set(prev).add(action.id));
      }
    } catch (error) {
      console.error('Failed to add suggestion to work:', error);
    } finally {
      setAddingActionId(null);
    }
  };

  // Filter out added actions
  const displaySuggestions = suggestedActions.filter(a => !addedIds.has(a.id));

  // Empty state for no work items
  if (!hasWorkItems) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 text-center">
        <Layers className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-300">No active work</p>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Commit a Program from Deliver to start tracking work.
        </p>
        <Link
          href={`/c/${companyId}/deliver`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Go to Deliver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Suggested Actions Panel - Collapsible */}
      {!loadingSuggestions && displaySuggestions.length > 0 && (
        <div className="bg-slate-900/70 border border-purple-500/20 rounded-lg overflow-hidden">
          <button
            onClick={() => setSuggestionsCollapsed(!suggestionsCollapsed)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-slate-200">Suggested Actions</span>
              <span className="text-xs text-slate-500">({displaySuggestions.length})</span>
            </div>
            {suggestionsCollapsed ? (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {!suggestionsCollapsed && (
            <div className="px-4 pb-4 space-y-2">
              {displaySuggestions.map(action => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {action.isQuickWin && (
                        <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                      )}
                      <span className="text-sm text-slate-200 truncate">{action.action}</span>
                    </div>
                    {action.expectedImpact && (
                      <p className="text-xs text-slate-500 truncate">{action.expectedImpact}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddSuggestionToWork(action)}
                    disabled={addingActionId === action.id}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-md hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {addingActionId === action.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Master-Detail Layout */}
      <div className="flex gap-0 h-[calc(100vh-320px)] min-h-[500px] bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
        {/* Left: Work List Panel */}
        <div className="w-[380px] shrink-0 border-r border-slate-800">
          <WorkListPanel
            workItems={workItems}
            selectedWorkItemId={selectedWorkItemId}
            onSelectWorkItem={onSelectWorkItem}
            companyId={companyId}
          />
        </div>

        {/* Right: Work Details Panel */}
        <div className="flex-1 min-w-0">
          <WorkDetailsPanel
            workItem={selectedWorkItem}
            companyId={companyId}
            aiAdditionalInfo={aiAdditionalInfo}
            loadingAI={loadingAI}
            aiError={aiError}
            onGenerateAI={onAdditionalInfo}
            onClose={() => onSelectWorkItem(null)}
          />
        </div>
      </div>
    </div>
  );
}

function BacklogSection({
  priorities,
  evidence,
  strategicSnapshot,
  fullReportId,
  companyId,
  workItemsByPriorityId,
}: {
  priorities: PriorityItem[];
  evidence?: EvidencePayload;
  strategicSnapshot?: CompanyStrategicSnapshot | null;
  fullReportId?: string;
  companyId: string;
  workItemsByPriorityId: Record<string, WorkItemRecord>;
}) {
  const hasPriorities = priorities.length > 0;
  const hasFocusAreas = strategicSnapshot?.focusAreas && strategicSnapshot.focusAreas.length > 0;

  return (
    <div className="space-y-6">
      {/* Strategic Focus Areas */}
      {hasFocusAreas && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Strategic Focus Areas
            </h3>
            <p className="text-xs text-slate-500 mt-1">From Brain synthesis</p>
          </div>
          <ol className="space-y-2">
            {strategicSnapshot!.focusAreas.slice(0, 5).map((area, index) => (
              <li key={index} className="flex items-start gap-3 group">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm text-slate-300 pt-0.5">{area}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Telemetry Highlights */}
      {evidence && (evidence.metrics?.length || evidence.insights?.length) && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Telemetry Highlights
          </h3>

          {evidence.insights && evidence.insights.length > 0 && (
            <div className="space-y-2.5 mb-4">
              {evidence.insights
                .filter((insight) =>
                  !insight.area ||
                  insight.area === 'SEO' ||
                  insight.area === 'Content' ||
                  insight.area === 'Website UX'
                )
                .slice(0, 3)
                .map((insight) => {
                  const headline = insight.headline || insight.title || 'Untitled';
                  const detail = insight.detail || insight.description;

                  return (
                    <div
                      key={insight.id}
                      className="rounded-lg border border-slate-700/50 bg-[#050509]/50 px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        {insight.severity && (
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                            insight.severity.toLowerCase() === 'critical' ? 'bg-red-500' :
                            insight.severity.toLowerCase() === 'high' ? 'bg-orange-500' :
                            insight.severity.toLowerCase() === 'medium' ? 'bg-amber-500' :
                            insight.severity.toLowerCase() === 'low' ? 'bg-sky-500' :
                            'bg-blue-500'
                          }`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 leading-snug">{headline}</p>
                          {detail && (
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{detail}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Suggested Work from Full Report */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Suggested Work from OS
          </h3>
          <p className="text-xs text-slate-500 mt-1">From latest Full Report</p>
        </div>

        {!hasPriorities ? (
          <EmptyState
            title="No Priorities Found"
            description="No structured priorities were found. Run diagnostics to generate opportunities."
          />
        ) : (
          <div className="space-y-3">
            {priorities.slice(0, 10).map((priority, idx) => {
              const hasWorkItem = priority.id ? !!workItemsByPriorityId[priority.id] : false;
              const matchingInsight =
                (priority.area === 'SEO' || priority.area === 'Content' || priority.area === 'Website UX') &&
                evidence?.insights
                  ? evidence.insights.find((insight) => insight.area === priority.area)
                  : undefined;

              return (
                <PriorityCardWithAction
                  key={priority.id || idx}
                  priority={priority}
                  companyId={companyId}
                  fullReportId={fullReportId || ''}
                  hasWorkItem={hasWorkItem}
                  evidenceInsight={matchingInsight}
                />
              );
            })}

            {priorities.length > 10 && (
              <p className="text-xs text-slate-500 text-center pt-2">
                + {priorities.length - 10} more priorities
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-8">
      <div className="mb-4">
        <svg
          className="mx-auto h-12 w-12 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">{description}</p>
    </div>
  );
}
